// Mock для методов Telegram Bot API
export class TelegramApiMock {
  public sentMessages: Array<{ method: string; payload: any }> = [];

  mockSendMessage(chatId: number, text: string, options?: any): void {
    this.sentMessages.push({
      method: 'sendMessage',
      payload: { chatId, text, options },
    });
  }

  mockEditMessageText(chatId: number, messageId: number, text: string): void {
    this.sentMessages.push({
      method: 'editMessageText',
      payload: { chatId, messageId, text },
    });
  }

  mockAnswerCallbackQuery(callbackQueryId: string): void {
    this.sentMessages.push({
      method: 'answerCallbackQuery',
      payload: { callbackQueryId },
    });
  }

  reset(): void {
    this.sentMessages = [];
  }

  getLastMessage(): any {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  getAllMessages(): any[] {
    return [...this.sentMessages];
  }
}

