# Prints "key<TAB>values-json" for every concept, using the tuned values where tuning ran.
import json, sys, glob
best = {}
for f in glob.glob(sys.argv[1] + '/tune*.jsonl'):
    for l in open(f):
        try: d = json.loads(l)
        except Exception: continue
        best[d['key']] = d['best'][0]['v']
for k in sys.argv[2:]:
    print(k + '\t' + (json.dumps(best[k]) if k in best else ''))
