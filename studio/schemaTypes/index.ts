import {bookClubDiscovery} from './documents/bookClubDiscovery'
import {bookClubWatchRun} from './documents/bookClubWatchRun'
import {author} from './documents/author'
import {catalogImportIdentity} from './documents/catalogImportIdentity'
import {book} from './documents/book'
import {celebrityClub} from './documents/celebrityClub'
import {celebritySelection} from './documents/celebritySelection'
import {clubMembership} from './documents/clubMembership'
import {communityClub} from './documents/communityClub'
import {curatedCollection} from './documents/curatedCollection'
import {discussionPost} from './documents/discussionPost'
import {discussionThread} from './documents/discussionThread'
import {edition} from './documents/edition'
import {editorialCollection} from './documents/editorialCollection'
import {genre} from './documents/genre'
import {poll} from './documents/poll'
import {rating} from './documents/rating'
import {readerProfile} from './documents/readerProfile'
import {readingProgress} from './documents/readingProgress'
import {review} from './documents/review'
import {shelf} from './documents/shelf'
import {shelfEntry} from './documents/shelfEntry'
import {siteSettings} from './documents/siteSettings'
import {vote} from './documents/vote'
import {ratingStats} from './objects/ratingStats'
import {sourceProvenance} from './objects/sourceProvenance'

export const schemaTypes = [
  bookClubDiscovery,
  bookClubWatchRun,
  catalogImportIdentity,
  sourceProvenance,
  ratingStats,
  edition,
  book,
  curatedCollection,
  author,
  genre,
  editorialCollection,
  celebrityClub,
  celebritySelection,
  siteSettings,
  readerProfile,
  rating,
  review,
  shelf,
  shelfEntry,
  readingProgress,
  communityClub,
  clubMembership,
  poll,
  vote,
  discussionThread,
  discussionPost,
]
