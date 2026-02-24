import { PublishNotificationInput, publishNotification } from './notificationPublisher';

interface QueueItem {
  input: PublishNotificationInput;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

const notificationQueue: QueueItem[] = [];
let isProcessing = false;

const processQueue = async (): Promise<void> => {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  while (notificationQueue.length > 0) {
    const item = notificationQueue.shift();
    if (!item) {
      continue;
    }

    try {
      const result = await publishNotification(item.input);
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    }
  }

  isProcessing = false;
};

export const enqueueNotificationJob = async (
  input: PublishNotificationInput
): Promise<any> => {
  return await new Promise((resolve, reject) => {
    notificationQueue.push({ input, resolve, reject });
    void processQueue();
  });
};
