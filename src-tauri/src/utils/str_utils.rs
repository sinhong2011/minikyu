//! UTF-8-safe string utilities.

/// Truncates a string to at most `max_bytes` bytes without splitting
/// a multi-byte UTF-8 character. The returned slice may be shorter than
/// `max_bytes` if the boundary falls inside a character.
pub fn truncate_str(s: &str, max_bytes: usize) -> &str {
    if s.len() <= max_bytes {
        return s;
    }
    // floor_char_boundary finds the largest index <= max_bytes that is a char boundary
    let end = floor_char_boundary(s, max_bytes);
    &s[..end]
}

/// Returns the largest byte index `<= i` that is a UTF-8 char boundary.
/// Equivalent to `str::floor_char_boundary` (stabilised in Rust 1.82).
fn floor_char_boundary(s: &str, i: usize) -> usize {
    if i >= s.len() {
        return s.len();
    }
    let mut pos = i;
    while pos > 0 && !s.is_char_boundary(pos) {
        pos -= 1;
    }
    pos
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ascii_within_limit() {
        assert_eq!(truncate_str("hello", 10), "hello");
    }

    #[test]
    fn ascii_exact() {
        assert_eq!(truncate_str("hello", 5), "hello");
    }

    #[test]
    fn ascii_truncated() {
        assert_eq!(truncate_str("hello world", 5), "hello");
    }

    #[test]
    fn cjk_safe_boundary() {
        let s = "\u{4f60}\u{597d}\u{4e16}\u{754c}"; // 你好世界 (12 bytes, 3 per char)
        assert_eq!(truncate_str(s, 6), "\u{4f60}\u{597d}"); // 2 chars
        assert_eq!(truncate_str(s, 7), "\u{4f60}\u{597d}"); // rounds down
        assert_eq!(truncate_str(s, 8), "\u{4f60}\u{597d}"); // rounds down
        assert_eq!(truncate_str(s, 9), "\u{4f60}\u{597d}\u{4e16}"); // 3 chars
    }

    #[test]
    fn emoji_safe_boundary() {
        let s = "a\u{1F600}b"; // a😀b (6 bytes: 1 + 4 + 1)
        assert_eq!(truncate_str(s, 1), "a");
        assert_eq!(truncate_str(s, 2), "a"); // mid-emoji, rounds down
        assert_eq!(truncate_str(s, 5), "a\u{1F600}");
        assert_eq!(truncate_str(s, 6), "a\u{1F600}b");
    }

    #[test]
    fn empty_string() {
        assert_eq!(truncate_str("", 10), "");
        assert_eq!(truncate_str("", 0), "");
    }

    #[test]
    fn zero_limit() {
        assert_eq!(truncate_str("hello", 0), "");
    }
}
