import argparse
import sys
from pathlib import Path

from .exporter import export_fold_file
from .replay import replay_mjcf


def main() -> None:
    argv = sys.argv[1:]
    if argv and argv[0] not in ("convert", "replay", "-h", "--help"):
        argv = ["convert", *argv]
    parser = argparse.ArgumentParser(description="Origami FOLD to MuJoCo MJCF tools.")
    subparsers = parser.add_subparsers(dest="command")

    convert = subparsers.add_parser("convert", help="Convert a small FOLD JSON crease pattern to MJCF.")
    add_convert_args(convert)

    replay = subparsers.add_parser("replay", help="Replay a fold plan against a MuJoCo model and write JSONL logs.")
    replay.add_argument("model", type=Path, help="Input MJCF XML path")
    replay.add_argument("plan", type=Path, help="Input fold_plan JSON path")
    replay.add_argument("--log", type=Path, default=Path("run.jsonl"), help="Output replay JSONL path")
    replay.add_argument("--duration", type=float, default=2.0, help="Replay duration in seconds")
    replay.add_argument("--fps", type=float, default=60.0, help="Log sampling rate")

    args = parser.parse_args(argv)
    if args.command == "replay":
        try:
            replay_mjcf(args.model, args.plan, args.log, duration=args.duration, fps=args.fps)
        except RuntimeError as exc:
            parser.exit(2, f"{exc}\n")
        print(f"wrote {args.log}")
        return

    if args.command == "convert":
        if not args.fold:
            parser.error("convert requires an input FOLD JSON file")
        export_fold_file(args.fold, args.out, args.plan)
        print(f"wrote {args.out}")
        print(f"wrote {args.plan}")
        return

    parser.print_help()


def add_convert_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("fold", type=Path, nargs="?", help="Input FOLD JSON file")
    parser.add_argument("--out", type=Path, default=Path("model.xml"), help="Output MJCF XML path")
    parser.add_argument("--plan", type=Path, default=Path("fold_plan.json"), help="Output fold schedule JSON path")


if __name__ == "__main__":
    main()
