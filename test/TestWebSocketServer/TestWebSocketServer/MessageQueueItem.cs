using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TestWebSocketServer
{
    public struct MessageQueueItem
    {
        public Guid ID { get; set; }
        public int RetryCount { get; set; }
        public string Message { get; set; }
        public string Receiver { get; set; }

        public MessageQueueItem(string message, string receiver)
        {
            ID = Guid.NewGuid();
            Message = message;
            Receiver = receiver;
            RetryCount = 0;
        }
    }
}
