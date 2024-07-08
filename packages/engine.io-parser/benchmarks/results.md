
Current

```
encode packet as string x 175,944 ops/sec ±5.64% (25 runs sampled)
encode packet as binary x 176,945 ops/sec ±16.60% (51 runs sampled)
encode payload as string x 47,836 ops/sec ±9.84% (34 runs sampled)
encode payload as binary x 123,987 ops/sec ±22.03% (53 runs sampled)
decode packet from string x 27,680,068 ops/sec ±0.92% (89 runs sampled)
decode packet from binary x 7,747,089 ops/sec ±1.65% (83 runs sampled)
decode payload from string x 198,908 ops/sec ±27.95% (23 runs sampled)
decode payload from binary x 179,574 ops/sec ±41.32% (23 runs sampled)
```

Results from parser v2 / protocol v3

```
encode packet as string x 228,038 ops/sec ±9.28% (40 runs sampled)
encode packet as binary x 163,392 ops/sec ±8.72% (67 runs sampled)
encode payload as string x 73,457 ops/sec ±14.83% (56 runs sampled)
encode payload as binary x 71,400 ops/sec ±3.63% (75 runs sampled)
decode packet from string x 22,712,325 ops/sec ±3.14% (90 runs sampled)
decode packet from binary x 4,849,781 ops/sec ±1.27% (87 runs sampled)
decode payload from string x 82,514 ops/sec ±49.93% (22 runs sampled)
decode payload from binary x 149,206 ops/sec ±25.90% (76 runs sampled)
```
