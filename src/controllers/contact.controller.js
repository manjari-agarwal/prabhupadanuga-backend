import ContactMessage from '../models/ContactMessage.js';
import { success } from '../utils/apiResponse.js';

export async function submitContactMessage(req, res) {
  const { name, email, subject, message } = req.body;
  const record = await ContactMessage.create({
    user: req.user._id,
    name,
    email,
    subject,
    message
  });
  return success(res, {
    id: record.id,
    status: record.status,
    submittedAt: record.createdAt
  }, 'Your message has been received', 201);
}
