# Books and editions

A `book` represents the shared work. Recommendations, ratings, reviews, and shelf membership continue to use its ID. Each `edition` references that book and carries its own ISBN, publisher, release date, page count, language, format, translator credits, edition statement, and cover.

In Studio, open **Everlogue Shelf → Editions** to add or correct a version and link it to its book. ISBN validation checks the checksum and duplicate editions, including equivalent ISBN-10/ISBN-13 identifiers. The book form shows a live Editions section with links to each copy. Older book-level publication fields are hidden and retained only for data compatibility; copy-specific details belong on editions. An unchanged reprint with the same ISBN should reuse its edition.

On a book page, readers can browse recorded editions. After adding the book to a reading shelf, they can find a copy by ISBN, review its details, select it, or clear their selection. Saving synchronizes the optional edition reference on their reading progress and shelf entries. It preserves their rating, status, dates, and the underlying book identity.

ISBN lookup reuses catalog records before requesting Google Books and Open Library metadata. It only accepts metadata for the requested ISBN and verifies the work using an existing relationship, Open Library work ID, or matching title and author. Translations that cannot be verified automatically require an editor to link them. Unknown format or translator information stays empty and can be edited in Studio.

Imports use an ISBN identity guard to prevent concurrent duplicate editions. Metadata refreshes fill missing fields, respect editorial locks, and are limited to once per day. Editions are discovered through imports and reader lookups; no exhaustive provider catalog is downloaded.

Catalog cards keep the book’s manual cover, falling back to imported imagery. A shelf uses the selected edition’s cover when available, otherwise the catalog cover. Library exports use the selected edition’s ISBNs without mixing missing identifiers from another edition.

Existing production records are not bulk migrated or merged by this change. Camera barcode scanning is not included; the ISBN field accepts typed, pasted, or keyboard-scanner input.
