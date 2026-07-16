const buildFileUrl = (req, file) => {
  if (!file) return null;
  // If the file was uploaded via Supabase storage (when configured), we can return that URL.
  // Otherwise, return the local server absolute URL.
  const host = req.get('host');
  const protocol = req.protocol;
  return `${protocol}://${host}/uploads/${file.filename}`;
};

const buildFilesUrls = (req, files) => {
  if (!files || !files.length) return [];
  return files.map(file => buildFileUrl(req, file));
};

module.exports = {
  buildFileUrl,
  buildFilesUrls
};
