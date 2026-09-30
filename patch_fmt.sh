#!/bin/bash
FMT_FILE="ios/Pods/fmt/include/fmt/format-inl.h"
if [ -f "$FMT_FILE" ]; then
  sed -i '' 's/#define FMT_USE_CONSTEVAL 1/#define FMT_USE_CONSTEVAL 0/g' "$FMT_FILE"
  echo "✅ FMT_USE_CONSTEVAL = 0 appliqué"
fi
