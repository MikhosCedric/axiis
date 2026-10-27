// Whether G or A was just pressed, so the next key belongs to that sequence. The palette's
// document listener runs after React's handlers on a row, so a row checks this before a key
// such as D (which also ends G then D, for Due) does something of its own.
let pending = false;

export function sequencePending(): boolean {
  return pending;
}

export function setSequencePending(value: boolean) {
  pending = value;
}
