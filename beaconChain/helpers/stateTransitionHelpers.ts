import {keccak256} from 'js-sha3';
import _ from 'lodash';

// Relative imports
import {EPOCH_LENGTH, MAX_DEPOSIT} from "../constants/constants";
import { ValidatorStatusCodes } from "../constants/enums";
import {AttestationData, BeaconBlock} from "../interfaces/blocks";
import {BeaconState, ShardCommittee, ValidatorRecord} from "../interfaces/state";

type int = number;
type bytes = number;
type uint24 = number;
type hash32 = string;

/**
 * The following is a function that gets active validator indices from the validator list.
 * @param {ValidatorRecord[]} validators
 * @returns {int[]}
 */
export function getActiveValidatorIndices(validators: ValidatorRecord[]): int[] {
  return validators.reduce((accumulator: int[], validator: ValidatorRecord, index: int) => {
    return validator.status === ValidatorStatusCodes.ACTIVE
    ? [...accumulator, index]
    : accumulator;
  }, []);
}

/**
 * The following is a function that shuffles any list; we primarily use it for the validator list.
 * @param {T[]} values
 * @param {hash32} seed
 * @returns {T[]} Returns the shuffled values with seed as entropy.
 */
// TODO finish
function shuffle<T>(values: T[], seed: hash32): T[] {
  const valuesCount: int = values.length;
  // Entropy is consumed from the seed in 3-byte (24 bit) chunks.
  const randBytes: int = 3;
  // Highest possible result of the RNG
  const randMax: int = 2 ** (randBytes * 8) - 1;

  // The range of the RNG places an upper-bound on the size of the list that may be shuffled.
  // It is a logic error to supply an oversized list.
  if (valuesCount < randMax) { throw new Error("Oversized list supplied to shuffle()!"); }

  // Make a copy of the values
  const output: T[] = values.slice();
  let source: string = seed;
  let index: int = 0;
  while (index < valuesCount - 1) {
    // Re-hash the `source` to obtain a new pattern of bytes.
    source = keccak256(source);
    // NOTE: usage of lodash.range() method to mimic python range.
    for (let position in _.range(0, 32 - (32 % randBytes), randBytes)) {

      // Determine the number of indices remaining in `values` and exit
      // once the last index is reached.
      let remaining: int = valuesCount - index;
      if (remaining === 1) break;

      // Read 3-bytes of `source` as a 24-bit big-endian integer.
      // TODO: It should be noted at this point we need to do some math in regards to
      // TODO bytes. Will need to look at our best alternatives since class Buffer is a node
      // TODO specific package. For the time being stubbing the return value as an integer.
      // TODO: typeof position === string .... ? Should be a number.
      let sampleFromSource = source.slice(position, (position + randBytes));

      // Sample values greater than or equal to `sample_max` will cause
      // modulo bias when mapped into the `remaining` range.
      let sampleMax = randMax - randMax % remaining;

      // Perform a swap if the consumed entropy will not cause modulo bias.
      if (sampleFromSource < sampleMax) {
        // Select a replacement index for the current index.
        let replacementPosition = (sampleFromSource % remaining) + index;

        // Store previous index value before the swap.
        let prevIndex = output[index];

        // Swap the current index with the replacement index.
        output[index] = output[replacementPosition];
        output[replacementPosition] = prevIndex;
        index += 1;
      }
    }
  }
  return output;
}

/**
 * Splits a list into split_count pieces.
 * @param {T[]} values
 * @param {int} splitCount
 * @returns {T[]}
 */
export function split<T>(values: T[], splitCount: int): T[][] {
  // Returns the split ``seq`` in ``split_count`` pieces in protocol.
  const listLength: int = values.length;
  const array: T[][] = [];
  for (let i: int = 0; i < splitCount; i++) {
    array.push(values.slice(
      Math.floor((listLength * i) / splitCount), Math.floor((listLength * (i + 1)) / splitCount),
    ));
  }
  return array;
}

/**
 * Helper function for readability.
 * @param {int} minval
 * @param {int} maxval
 * @param {int} x
 * @returns {int}
 */
export function clamp(minval: int, maxval: int, x: int): int {
  if (x <= minval) {
    return minval;
  } else if (x >= maxval) {
    return maxval;
  }
  return x;
}

/**
 * Determines the shards and committee for a given beacon block.
 * Should not change unless the validator set changes.
 * @param {BeaconState} state
 * @param {int} slot
 * @returns {ShardAndCommittee[] | Error}
 */
function getShardCommitteesAtSlot(state: BeaconState, slot: int): ShardCommittee[] {
  const earliestSlotInArray: int = state.slot - (state.slot % EPOCH_LENGTH) - EPOCH_LENGTH;
  if (earliestSlotInArray <= slot && slot < earliestSlotInArray + EPOCH_LENGTH * 2) {
    throw new Error();
  }
  return state.shardCommitteesAtSlots[slot - earliestSlotInArray];
}

/**
 * Retrieves hash for a given beacon block.
 * It should always return the block hash in the beacon chain slot for `slot`.
 * @param {BeaconState} state
 * @param {int} slot
 * @returns {hash32}
 */
function getBlockRoot(state: BeaconState, slot: int): hash32 {
  const earliestSlotInArray = state.slot - state.latestBlockHashes.length;
  if (earliestSlotInArray <= slot && slot < state.slot) throw new Error();
  return state.latestBlockHashes[slot - earliestSlotInArray];
}

/**
 * Determines the proposer of a beacon block.
 * @param {BeaconState} state
 * @param {int} slot
 * @returns {int}
 */
function getBeaconProposerIndex(state: BeaconState, slot: int): int {
  const firstCommittee = getShardCommitteesAtSlot(state, slot)[0].committee;
  return firstCommittee[slot % firstCommittee.length];
}

// TODO finish
function getAttestationParticipants(state: BeaconState, attestationData: AttestationData, participationBitfield: bytes): int[] {
  const shardCommittees: ShardCommittee[] = getShardCommitteesAtSlot(state, attestationData.slot);
  const shardCommittee: ShardCommittee = shardCommittees.filter((x: ShardCommittee) => {
    return x.shard === attestationData.shard;
  })[0];

  // TODO Figure out why this is an error
  // TODO implement error based on python pseudo code
  // TODO what is ceil_div8()
  // assert len(participation_bitfield) == ceil_div8(len(snc.committee))

  const participants: int[] = shardCommittee.committee.filter((validator: uint24, index: int) => {
    const bit: int = (participationBitfield[Math.floor(index / 8)] >> (7 - (index % 8))) % 2;
    return bit === 1;
  });
  return participants;
}

/**
 * Determine the balance of a validator.
 * Used for determining punishments and calculating stake.
 * @param {ValidatorRecord} validator
 * @returns {int}
 */
// TODO Math.min requires int, validator.record is a uint64
function getEffectiveBalance(validator: ValidatorRecord): int {
  return Math.min(validator.balance, MAX_DEPOSIT);
}

// TODO figure out what bytes1() does in python
// function getNewValidatorSetDeltaHashChain(currentValidator: hash32, index: int, pubkey: int, flag: int): hash32 {
//   return newValidatorSetDeltaHashChain = hash(
//     currentValidator + bytes1(flag) + bytes3(index) + bytes32(pubkey)
//   )
// }

/**
 * Calculate the largest integer k such that k**2 <= n.
 * Used in reward/penalty calculations
 * @param {int} n
 * @returns {int}
 */
// TODO Can use built in JS function if available
export function intSqrt(n: int): int {
  let x: int = n;
  let y: int = Math.floor((x + 1) / 2);
  while (y < x) {
    x = y;
    y = Math.floor((x + Math.floor(n / x)) / 2);
  }
  return x;
}
