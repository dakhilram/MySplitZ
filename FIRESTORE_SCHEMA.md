# MySplitZ data model

Collections use generated document IDs and only store IDs for relationships.

| Collection | Core fields |
| --- | --- |
| `people` | `name`, `phone`, `email`, `notes`, `archived`, `createdAt` |
| `trips` | `name`, `description`, `startDate`, `endDate`, `memberIds`, `archived`, `createdAt` |
| `expenses` | `title`, `amount`, `category`, `date`, `note`, `tripId`, `paidBy`, `participantIds`, `splitMethod`, `createdAt`, `updatedAt` |
| `settlements` | `from`, `to`, `amount`, `date`, `note`, `tripId`, `createdAt` |
| `activity` | `text`, `kind`, `amount`, `tripId`, `date` |

Balances are not stored. The app derives them from expense credits, equal shares, and settlement entries, so edits and deletes always recalculate the same source data.

## Firebase setup

1. Create a Firebase project and a Firestore database.
2. Enable Firebase Authentication for the single administrator account before applying `firestore.rules`.
3. Copy `.env.example` to `.env.local`, then enter the Firebase web configuration values.
4. Deploy the security rules from `firestore.rules`.

Without Firebase settings, the app runs with the included sample trip and saves changes only in the browser, which is useful for trying the interface.
