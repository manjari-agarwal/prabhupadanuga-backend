import { uploadHubMedia } from '../services/media.service.js';
import { success } from '../utils/apiResponse.js';

export async function uploadMedia(req, res) {
  const mediaUrl = await uploadHubMedia(req.user.id, req.params.type, req.file);
  return success(res, { mediaUrl }, 'Media uploaded successfully', 201);
}
