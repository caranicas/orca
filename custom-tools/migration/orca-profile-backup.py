#!/usr/bin/env python3
"""Private, read-only snapshots; SQLite is copied through its online backup API."""
import argparse
from contextlib import closing
import json
import os
from pathlib import Path
import shutil
import sqlite3
import stat
import time

CACHE_DIRS = {
    "Cache", "Code Cache", "GPUCache", "DawnGraphiteCache", "DawnWebGPUCache",
    "Crashpad", "blob_storage",
}
VOLATILE_NAMES = {
    "SingletonLock", "SingletonCookie", "SingletonSocket", "DevToolsActivePort",
    "orca-runtime.json", "orcad.lock", "LOCK",
}
CORE_DIRS = {
    "profiles", "terminal-history", "agent-session-runtimes", "agent-session-attachments",
    "ai-vault", "agent-hooks", "codex-session-backfill", "shell-wrappers",
}


def is_sqlite(path):
    with path.open("rb") as stream:
        return stream.read(16) == b"SQLite format 3\0"


def snapshot_profile(source, destination, core_only=False):
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if destination == source or source in destination.parents or destination in source.parents:
        raise ValueError("Backup and source must be separate directories")
    if not source.is_dir() or destination.exists():
        raise ValueError("Source must exist and backup destination must be new")
    destination.mkdir(parents=True, mode=0o700)
    counts = {"files": 0, "sqlite": 0, "skipped": 0}
    for folder, directories, files in os.walk(source, followlinks=False):
        folder = Path(folder)
        directories[:] = [name for name in directories
                           if name not in CACHE_DIRS and not (folder / name).is_symlink()]
        if core_only and folder == source:
            directories[:] = [name for name in directories if name in CORE_DIRS]
        target = destination / folder.relative_to(source)
        target.mkdir(exist_ok=True, mode=0o700)
        os.chmod(target, 0o700)
        for name in files:
            item = folder / name
            if core_only and folder == source and not (
                    name.endswith((".json", ".db", ".key", "-wal", "-shm"))):
                continue
            if name in VOLATILE_NAMES or not stat.S_ISREG(item.lstat().st_mode):
                counts["skipped"] += 1
                continue
            if name.endswith(("-wal", "-shm", "-journal")):
                base = item.with_name(name.rsplit("-", 1)[0])
                if base.is_file() and is_sqlite(base):
                    counts["skipped"] += 1
                    continue
            output = target / name
            if is_sqlite(item):
                deadline = time.monotonic() + 15

                def check_deadline(status, remaining, total):
                    if time.monotonic() > deadline:
                        raise TimeoutError("SQLite file stayed busy; backup stopped safely")

                with closing(sqlite3.connect(item.as_uri() + "?mode=ro", uri=True)) as reader:
                    with closing(sqlite3.connect(output)) as writer:
                        reader.backup(writer, pages=256, progress=check_deadline)
                        result = writer.execute("PRAGMA quick_check").fetchone()
                        if result != ("ok",):
                            raise RuntimeError("SQLite backup integrity check failed")
                counts["sqlite"] += 1
            else:
                shutil.copyfile(item, output, follow_symlinks=False)
            os.chmod(output, 0o600)
            counts["files"] += 1
    return counts


def audit_profile(source):
    source = Path(source).resolve()
    index = json.loads((source / "orca-profile-index.json").read_text())
    profile_id = index.get("activeProfileId")
    if not isinstance(profile_id, str) or Path(profile_id).name != profile_id:
        raise ValueError("Invalid active profile ID")
    database = source / "profiles" / profile_id / "profile-state.db"
    with closing(sqlite3.connect(database.as_uri() + "?mode=ro", uri=True)) as reader:
        schema = reader.execute(
            "SELECT payload FROM profile_state_documents WHERE domain='schemaVersion'"
        ).fetchone()
        if not schema or json.loads(schema[0]) != 1:
            raise ValueError("Unrecognized profile schema; handover stopped")
        row = reader.execute(
            "SELECT payload FROM profile_state_documents WHERE domain='workspaceSession'"
        ).fetchone()
    session = json.loads(row[0]) if row else {}
    return {"schema": 1, "workspacesWithSavedTabs": len(session.get("tabsByWorktree", {}))}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--original")
    parser.add_argument("--custom")
    parser.add_argument("--profile")
    parser.add_argument("--output", required=True)
    parser.add_argument("--core-only", action="store_true")
    arguments = parser.parse_args()
    if arguments.profile:
        if arguments.original or arguments.custom:
            parser.error("Use --profile or the --original/--custom pair")
        sources = {"profile": arguments.profile}
    else:
        if not arguments.original or not arguments.custom:
            parser.error("Provide --profile or both --original and --custom")
        sources = {"original": arguments.original, "custom": arguments.custom}
    os.umask(0o077)
    output = Path(arguments.output).resolve()
    if output.exists():
        raise ValueError("Backup location already exists")
    for source in sources.values():
        root = Path(source).resolve()
        if root == output or root in output.parents or output in root.parents:
            raise ValueError("Backup location overlaps a source")
    audits = {label: audit_profile(source) for label, source in sources.items()}
    output.mkdir(parents=True, mode=0o700)
    results = {}
    for label, root in sources.items():
        results[label] = {**snapshot_profile(root, output / label, arguments.core_only), **audits[label]}
    (output / "manifest.json").write_text(json.dumps(results, indent=2) + "\n")
    print(json.dumps(results))


if __name__ == "__main__":
    main()
