import {defineField} from 'sanity'

export const selectedEdition = defineField({
  name: 'edition',
  title: 'Selected edition',
  description: 'Optional: the reader’s particular copy of the linked book.',
  type: 'reference',
  to: [{type: 'edition'}],
  options: {
    disableNew: true,
    filter: ({document}) => ({
      filter: 'book._ref == $bookId',
      params: {bookId: (document.book as {_ref?: string} | undefined)?._ref || ''},
    }),
  },
  validation: (rule) => rule.custom(async (value, context) => {
    if (!value?._ref) return true
    const bookId = (context.document?.book as {_ref?: string} | undefined)?._ref
    if (!bookId) return 'Choose a book first'
    const matches = await context.getClient({apiVersion: '2026-02-01'}).fetch<boolean>(
      `count(*[_type == "edition" && _id == $editionId && book._ref == $bookId]) == 1`,
      {editionId: value._ref, bookId},
    )
    return matches || 'The selected edition must belong to this book'
  }),
})
