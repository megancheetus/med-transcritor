import { TranscriptionModelType } from '@/lib/transcriptionModels';

export interface HistoryEntry {
  id: string;
  timestamp: string;
  model: TranscriptionModelType;
  duration: number;
  audioId?: string;
}