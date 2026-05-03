export interface CollaborativeEditorProps {
  roomName: string;
  username: string;
  color: string;
  paperSize?: 'a4' | 'letter' | 'legal';
  onContentUpdate?: (text: string) => void;
  title?: string;
  onTitleChange?: (title: string) => void;
  readOnly?: boolean;
}
