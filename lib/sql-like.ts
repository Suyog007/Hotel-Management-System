/**
 * Escape LIKE/ILIKE metacharacters so a value matches literally.
 *
 * `_` and `%` are SQL wildcards and `_` is a legal email local-part character,
 * so an unescaped `.ilike("email", value)` treats `a_b@x.com` as a pattern that
 * also matches `axb@x.com`. Wrapping the value with this keeps case-insensitive
 * matching while forcing the wildcards to be literal (backslash is PostgreSQL's
 * default LIKE escape character).
 */
export function escapeLike(value: string): string {
  return value.replace(/([\\%_])/g, "\\$1");
}
