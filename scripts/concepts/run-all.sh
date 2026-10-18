#!/bin/bash
# ./run-all.sh <results dir> key1 key2 … : full evaluation of each concept, 4 at a time.
R=$1; shift
cd "$(dirname "$0")"
while IFS=$'\t' read -r k v; do
  while [ "$(jobs -rp | wc -l)" -ge "${JOBS:-4}" ]; do wait -n; done
  npx tsx run-eval.ts "$k" "$v" > "$R/eval-$k.txt" 2>&1 &
done < <(python3 best-values.py "$R" "$@")
wait
