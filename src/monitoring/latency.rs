pub fn calculate_p99_latency(response_times: &[i64]) -> i64 {
    if response_times.is_empty() {
        return 0;
    }
    // response_times must be sorted in ascending order
    let len = response_times.len();
    // Clamp percentile index within [0, len-1]
    let index = (len as f64 * 0.99).ceil() as usize - 1;
    let val = response_times[index.min(len - 1)];
    val.max(0) // Enforce BR-003: p99 latency must always be non-negative
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_p99_latency() {
        let metrics = vec![10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
        // len = 10. 10 * 0.99 = 9.9. ceil() = 10. index = 10 - 1 = 9.
        // val at index 9 is 100.
        assert_eq!(calculate_p99_latency(&metrics), 100);

        let metrics_large: Vec<i64> = (1..=100).collect();
        // len = 100. 100 * 0.99 = 99. ceil() = 99. index = 99 - 1 = 98.
        // val at index 98 is 99 (since it's 1-indexed collection, index 98 is 99).
        assert_eq!(calculate_p99_latency(&metrics_large), 99);

        let empty: Vec<i64> = vec![];
        assert_eq!(calculate_p99_latency(&empty), 0);

        let negative = vec![-10, -5, 0, 10];
        assert_eq!(calculate_p99_latency(&negative), 10); // clamped to 10
    }
}
