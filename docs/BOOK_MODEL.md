# Shared book catalog

`studio/schemaTypes/documents/book.ts` defines the only book document type.
The records themselves live in Sanity, under **Catalog → Books** in Studio.
Goodreads CSV imports, club imports, and the Open Library catalog importer all
create or reuse `_type: "book"` records.

- `book` stores titles, author names, publication information, covers, and source
  identifiers. Optional `authorReferences` preserve links to author profiles.
- `edition.book` links an ISBN, format, release date, and edition cover to a book.
- Ratings, reviews, reading progress, and shelf entries reference `book`. Personal
  ratings and reading history remain separate from shared book metadata.
- Club collection entries reference the same document type. Club links open
  `/books/[slug]`; records without a slug can also be opened by document ID.
- Manual book covers take priority. Otherwise the display uses the selected
  edition, the book's provider cover, or an available edition cover.

## Migrating the previous work records

```sh
node --import tsx scripts/migrate-books.ts          # read-only plan and backup
node --import tsx scripts/migrate-books.ts --apply  # apply and verify
```

The migration creates new book IDs because Sanity document types are immutable.
It copies all book metadata, converts author references into display names while
retaining those references, and rewrites references throughout the dataset.
Existing book records are retained; the migration does not guess which distinct
records should be merged. Source slugs are preserved, and `legacyWorkIds` records
the previous catalog IDs.

Copies, reference updates, and removal of the copied work records commit in one
transaction. Revision guards abort the transaction if affected records changed
since the backup. A private backup, plan, and verification report are written to
the temporary directory printed by the command. Repeating a completed migration
does not create additional books.

Library document IDs, star values, reading dates, shelf dates, and edition links
are preserved. Library writes resolve existing documents by their reader/book
relationship so records with pre-migration IDs can still be edited and removed.

To compare every Goodreads rating after migration:

```sh
node --import tsx scripts/audit-goodreads-ratings.ts /path/to/export.csv READER_ID
```
