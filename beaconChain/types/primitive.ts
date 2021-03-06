// TODO replace uint, bytes32, bytes

// Each type exported here contains both a compile-time type (a typescript interface) and a run-time type (a javascript variable)
// For more information, see ./index.ts

export type bool = boolean;
export type bytes = Uint8Array;
export type bytes32 = Uint8Array;
export type bytes48 = Uint8Array;
export type bytes96 = Uint8Array;
export type uint24 = number;
export type uint64 = number;
export type uint384 = number;

export const bool = "bool";
export const bytes = "bytes";
export const bytes32 = "bytes32";
export const bytes48 = "bytes48";
export const bytes96 = "bytes96";
export const uint24 = "uint24";
export const uint64 = "uint64";
export const uint384 = "uint384";

