// returns some string which is guaranteed to be the same for the same A,
// and guaranteed to be different for the different A
export type Hasher<T> = (a: T) => string;
