import argparse
import json
from pathlib import Path

from .exporter import export_fold_to_mjcf


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert a small FOLD JSON crease pattern to a prototype MuJoCo MJCF model.")
    parser.add_argument("fold", type=Path, help="Input FOLD JSON file")
    parser.add_argument("--out", type=Path, default=Path("model.xml"), help="Output MJCF XML path")
    parser.add_argument("--plan", type=Path, default=Path("fold_plan.json"), help="Output fold schedule JSON path")
    args = parser.parse_args()

    raw = json.loads(args.fold.read_text())
    mjcf, plan = export_fold_to_mjcf(raw, model_name=args.fold.stem)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.plan.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(mjcf)
    args.plan.write_text(json.dumps(plan, indent=2))
    print(f"wrote {args.out}")
    print(f"wrote {args.plan}")


if __name__ == "__main__":
    main()
