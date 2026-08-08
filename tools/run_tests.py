#!/usr/bin/env python3
"""
Run the test suite.

    python3 tools/run_tests.py

Three groups, and one that can't be here:

  geometry   tools/check_geom.py — proves designer/js/geom.js still
             matches tools/glyphspec.py, ~243 generated cases. This
             predates the suite; it is folded in so there is one command.
  python     tests/test_*.py — the corpus validator and the save path.
  node       tests/*.test.js — the block model, the sounds syntax, the
             lookup chain and reverse-decode, run against the site's own
             files in a shared context (see tests/harness.js).

  browser    tests/recognise.html — the recogniser samples SVG paths with
             getPointAtLength, which node has no answer for. Open the
             page; it prints pass/fail against measured floors.

Everything is stdlib and node's built-in runner. There are no
dependencies to install, which is deliberate: a suite you have to set up
is a suite that stops being run.
"""

import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

GROUPS = [
    ("geometry", [sys.executable, "tools/check_geom.py"]),
    ("python", [sys.executable, "-m", "unittest", "discover",
                "-s", "tests", "-p", "test_*.py", "-q"]),
    # A glob, not "tests/" — passing the directory makes node try to
    # REQUIRE it as a module, which fails on a folder with no index.
    ("node", ["node", "--test", "tests/*.test.js"]),
]


def run(name, argv):
    if argv[0] == "node" and not shutil.which("node"):
        print(f"  {name}: SKIPPED — node is not installed")
        return None
    # Flush before handing the terminal to a child: our prints are
    # buffered and the subprocess writes straight to the descriptor, so
    # without this every heading lands after all of the output it labels.
    print(f"\n=== {name} " + "=" * (60 - len(name)), flush=True)
    result = subprocess.run(argv, cwd=ROOT)
    return result.returncode == 0


def main():
    results = {}
    for name, argv in GROUPS:
        results[name] = run(name, argv)

    print("\n" + "=" * 68)
    failed = [n for n, ok in results.items() if ok is False]
    skipped = [n for n, ok in results.items() if ok is None]

    for name, ok in results.items():
        mark = "ok" if ok else ("skipped" if ok is None else "FAILED")
        print(f"  {name:<10} {mark}")

    print("\n  browser    tests/recognise.html — open it; node can't do SVG geometry")

    if skipped:
        print(f"\n{len(skipped)} group(s) skipped.")
    if failed:
        print(f"\n{len(failed)} group(s) FAILED: {', '.join(failed)}")
        return 1
    print("\nAll good.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
