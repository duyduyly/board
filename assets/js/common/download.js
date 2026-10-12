export function download(text, name, type = 'application/json') {
  const blob = new Blob([text], { type }),
    url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

export async function downloadAsset(path, name) {
  const response = await fetch(path);
  if (!response.ok) throw Error('asset download failed');
  download(await response.text(), name);
}
