// Day 29: count the primes up to n with a sieve. The same algorithm is in bench.js.
// Build (see package.json):  rustc --target wasm32-unknown-unknown -O --crate-type cdylib -C panic=abort -o count_primes.wasm lib.rs
// Native test (not WASM):    rustc --test -O lib.rs -o lib_test && ./lib_test

#[no_mangle]
pub extern "C" fn count_primes(n: u32) -> u32 {
    if n < 2 {
        return 0;
    }
    let n = n as usize;
    let mut composite = vec![false; n + 1];
    let mut count: u32 = 0;
    let mut i: usize = 2;
    while i <= n {
        if !composite[i] {
            count += 1;
            // u64 because usize is only 32 bits in WASM and i * i would overflow for large i
            let mut j = (i as u64) * (i as u64);
            while j <= n as u64 {
                composite[j as usize] = true;
                j += i as u64;
            }
        }
        i += 1;
    }
    count
}

#[cfg(test)]
mod tests {
    use super::count_primes;

    #[test]
    fn known_counts() {
        assert_eq!(count_primes(0), 0);
        assert_eq!(count_primes(1), 0);
        assert_eq!(count_primes(2), 1);
        assert_eq!(count_primes(10_000), 1_229);
        assert_eq!(count_primes(1_000_000), 78_498);
        assert_eq!(count_primes(100_000_000), 5_761_455);
    }
}
