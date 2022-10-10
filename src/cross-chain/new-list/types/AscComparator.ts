// returns the result in an ascedning way
// negative result means A goes before the B in the resulting array
// positive result means A goes after the B in the resulting array
export type AscComparator<T> = (a: T, b: T) => number;
