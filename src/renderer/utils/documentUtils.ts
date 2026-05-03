import { DocumentSchema } from '../services/firebase';

export interface BuiltInProperties {
  fileName: string;
  fileBaseName: string;
  fileExtension: string;
  filePath: string;
  fileFullName: string;
  folder: string;
  fileSize: number;
  createdTime: number;
  modifiedTime: number;
  fileLinks: number;
  fileBacklinks: number;
  fileEmbeds: number;
  fileTags: string[];
}

export const getBuiltInProperties = (
  doc: DocumentSchema, 
  allDocs: DocumentSchema[] = []
): BuiltInProperties => {
  const docType = doc.type || 'document';
  const extension = docType === 'document' ? '.md' : docType === 'folder' ? '' : `.${docType}`;
  const baseName = doc.title || 'Untitled';
  
  // Basic path calculation
  let path = baseName;
  let currentParentId = doc.parentId;
  let folderName = 'Root';

  while (currentParentId) {
    const parent = allDocs.find(d => d.id === currentParentId);
    if (parent) {
      path = `${parent.title}/${path}`;
      if (folderName === 'Root') folderName = parent.title;
      currentParentId = parent.parentId;
    } else {
      break;
    }
  }

  // Extract links
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  const links = (doc.searchText?.match(wikiLinkRegex) || []).length;

  // Extract backlinks (this is expensive, usually done in a separate hook/service)
  const backlinks = allDocs.filter(d => 
    d.searchText?.toLowerCase().includes(`[[${baseName.toLowerCase()}]]`)
  ).length;

  // Extract embeds (images)
  const embedRegex = /!\[\[([^\]]+)\]\]|!\[[^\]]*\]\(([^)]+)\)/g;
  const embeds = (doc.searchText?.match(embedRegex) || []).length;

  // Extract tags
  const tagRegex = /#([a-zA-Z0-9_-]+)/g;
  const contentTags = doc.searchText?.match(tagRegex)?.map(t => t.slice(1)) || [];
  const propertyTags = doc.properties?.tags?.value || [];
  const allTags = Array.from(new Set([...contentTags, ...propertyTags]));

  return {
    fileName: baseName,
    fileBaseName: baseName,
    fileExtension: extension,
    filePath: path,
    fileFullName: baseName + extension,
    folder: folderName,
    fileSize: (doc.content?.length || 0) + (doc.searchText?.length || 0),
    createdTime: doc.createdAt,
    modifiedTime: doc.updatedAt,
    fileLinks: links,
    fileBacklinks: backlinks,
    fileEmbeds: embeds,
    fileTags: allTags
  };
};
