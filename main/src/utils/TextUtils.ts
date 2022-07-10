/**
 * Copyright 2022 Simon Edwards <simon@simonzone.com>
 */

export function formatHumanBytes(numberBytes: number): string {
  const kibibytes = numberBytes / 1024;
  const mebibytes = numberBytes / (1024 * 1024);
  const gibibytes = numberBytes / (1024 * 1024 * 1024);
  let displayNumber = 0;
  let units = "";
  if (gibibytes > 1) {
    displayNumber = gibibytes;
    units = " GiB";
  } else if (mebibytes > 1) {
    displayNumber = mebibytes;
    units = " MiB";
  } else if (kibibytes > 1) {
    displayNumber = kibibytes;
    units = " KiB";
  } else {
    displayNumber = numberBytes;
    units = " b";
  }
  return displayNumber.toLocaleString("en-US", {minimumFractionDigits: 1, maximumFractionDigits: 1}) + units;
}

export function formatHumanDuration(durationSeconds: number): string {
  const ONE_HOUR = 60 * 60;
  const ONE_MINUTE = 60;

  if (durationSeconds >= ONE_HOUR) {
    const hours = Math.floor(durationSeconds / ONE_HOUR);
    const minutes = Math.floor((durationSeconds % ONE_HOUR) / 60);
    return `${hours}h${minutes}m`;

  } else if (durationSeconds >= ONE_MINUTE) {
    const minutes = Math.floor(durationSeconds / ONE_MINUTE);
    const seconds = Math.floor(durationSeconds % ONE_MINUTE);
    return `${minutes}m${seconds}s`;

  } else {
    const seconds = Math.floor(durationSeconds);
    return `${seconds}s`;
  }
}
