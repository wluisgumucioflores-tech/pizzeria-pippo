import { IsIn, IsString } from 'class-validator';

// The client only sends/receives plain conversation turns — intermediate
// tool-calling messages (role 'assistant' with toolCalls, role 'tool') are
// entirely internal to the agent loop and never travel to/from the frontend.
export class ChatMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  content!: string;
}
