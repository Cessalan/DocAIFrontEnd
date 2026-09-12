export function paperContour(left, right, top, bottom, footLeft, footRight, radius) {
  const depth = bottom - top;
  return `path('M ${left + radius} ${top} L ${right - radius} ${top} Q ${right} ${top} ${right} ${top + radius} C ${right} ${top + depth * .58} ${footRight} ${bottom - depth * .42} ${footRight} ${bottom - radius} Q ${footRight} ${bottom} ${footRight - radius} ${bottom} L ${footLeft + radius} ${bottom} Q ${footLeft} ${bottom} ${footLeft} ${bottom - radius} C ${footLeft} ${bottom - depth * .42} ${left} ${top + depth * .58} ${left} ${top + radius} Q ${left} ${top} ${left + radius} ${top} Z')`;
}
