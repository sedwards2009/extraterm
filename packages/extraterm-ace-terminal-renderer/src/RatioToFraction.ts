/**
 * Copyright 2019 Simon Edwards <simon@simonzone.com>
 */

const ERROR = 0.01;

/**
 * Given a real number r compute the fraction a/b such that a/b ~= r
 *
 * a/b/ approximately equals r.
 *
 * Note: This is biased towards real numbers with few decimal digits.
 */
export function ratioToFraction(n: number): [number, number] {

  // Turn n into an approximate fraction with integer numerator/denominator.
  let a = n;
  let b = 1;
  while (Math.abs(Math.round(a)-a)/a > ERROR) {
    a *= 10;
    b *= 10;
  }
  a = Math.round(a);

  // Simply the fraction
  const common = gcd(a, b);
  return [a/common, b/common];
}

function gcd(a: number, b: number): number {
  if (a === 0)  {
    return b;
  }

  return gcd(b % a, a);
}
