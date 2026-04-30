export { initDatabase, setupDatabase } from './databaseLifecycle.js';
export {
  checkMailboxOwnership,
  getMailboxIdByAddress,
  getMailboxIdForReceive,
  getOrCreateMailboxId,
  getTotalMailboxCount,
  toggleMailboxPin
} from './mailboxRepository.js';
export { recordSentEmail, updateSentEmail } from './sentEmailRepository.js';
export {
  assignMailboxToUser,
  createUser,
  deleteUser,
  getUserMailboxes,
  listUsersWithCounts,
  unassignMailboxFromUser,
  updateUser
} from './userRepository.js';
