using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using WebSocketSharp;
using WebSocketSharp.Server;

namespace TestWebSocketServer
{
    class Program
    {

        static void Main(string[] args)
        {
            var server = new WebSocketServer(6089);
            server.AddWebSocketService<TestService>("/test");
            Task.Run(GenerateServerMessage);
            server.Start();
            Console.ReadLine();
            server.Stop();
        }

        static void GenerateServerMessage() {
            while (true)
            {
                var dt = DateTime.Now;
                if (dt.Second == 0 || dt.Second == 30)
                {
                    TestService.PushMessage($"Current Time：{dt}", "1");
                    TestService.PushMessage($"当前的时间是：{dt}", "2");
                    TestService.PushMessage($"今の時間は：{dt}", "3");
                }
                Thread.Sleep(1000);
            }
        }
    }

    class TestService : WebSocketBehavior
    {
        static readonly ConcurrentQueue<MessageQueueItem> _messageQueue;
        static readonly SessionCache _sessions;
        static Thread _qpThread;
        static object _qpThreadLock = new object();
        static TestService()
        {
            _messageQueue = new ConcurrentQueue<MessageQueueItem>();
            _sessions = new SessionCache();
        }
        protected override void OnOpen()
        {
            base.OnOpen();
            if (_qpThread == null)
            {
                lock (_qpThreadLock)
                {
                    if (_qpThread == null)
                    {
                        _qpThread = new Thread(StartProcessQueue);
                        _qpThread.Start();
                    }
                }
            }
        }
        protected override void OnMessage(MessageEventArgs e)
        {
            // Check payload is ping.
            if (IsPing(e.Data))
            {
                this.Sessions.SendTo("pong", this.ID);
                return;
            }

            // Check user is authorized.
            var uid = _sessions.GetUserID(this.ID);
            if (uid != null)
            {
                var response = JsonConvert.SerializeObject(new { code = "200", reply = GenerateReply(uid, e.Data) });
                this.Sessions.SendTo(response, this.ID);
            }
            else
            {
                // user is not authorized.
                // try to authorize.
                try
                {
                    uid = CheckAuthorize(e.Data);
                    if (uid != null)
                    {
                        _sessions.BindUserID(this.ID, uid);
                    }
                    else
                    {
                        var response = JsonConvert.SerializeObject(new { code = "400", reply = "Unauthorized" });
                        this.Sessions.SendTo(response, this.ID);
                    }
                }
                catch (Exception ex)
                {
                    var response = JsonConvert.SerializeObject(new { code = "500", reply = "Something wrong!!!", error = ex.Message });
                    this.Sessions.SendTo(response, this.ID);
                }
            }

            base.OnMessage(e);
        }
        protected override void OnClose(CloseEventArgs e)
        {
            _sessions.CloseSession(this.ID);

            base.OnClose(e);
        }

        public static void PushMessage(string message, string uid)
        {
            _messageQueue.Enqueue(new MessageQueueItem(message, uid));
        }

        bool IsPing(string payload)
        {

            if (payload.Equals("ping", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
            else
            {
                return false;
            }
        }

        string GenerateReply(string uid, string payload)
        {

            if (uid.Equals("1", StringComparison.OrdinalIgnoreCase))
            {
                return $"you said: {payload}";
            }
            else if (uid.Equals("2", StringComparison.OrdinalIgnoreCase))
            {
                return $"你说了： {payload}";
            }
            else if (uid.Equals("3", StringComparison.OrdinalIgnoreCase))
            {
                return $"あなたが言ったこと： {payload}";
            }
            else
            {
                return "The user is not exists";
            }
        }

        string CheckAuthorize(string payload)
        {
            var json = JToken.Parse(payload);
            if (json["uid"] != null)
            {
                return json["uid"].ToString();
            }
            else
            {
                return null;
            }
        }

        void StartProcessQueue()
        {
            while (true)
            {
                if(_messageQueue.Count > 0)
                {
                    MessageQueueItem item;
                    _messageQueue.TryDequeue(out item);

                    var uid = item.Receiver;
                    var sids = _sessions.GetSessionID(uid);
                    var sidCount = sids.Count();
                    var successCount = 0;
                    if(sids != null && sidCount> 0)
                    {
                        Parallel.ForEach(sids, (sid, i) => {
                            var message = JsonConvert.SerializeObject(new { code = "200", reply = item.Message });
                            try
                            {
                                this.Sessions.SendTo(message, sid);
                                successCount += 1;
                            }
                            catch
                            {
                                Console.WriteLine($"Failed to send message to {sid}");
                            }
                        });

                        // All session sent successfully.
                        if(sidCount == successCount)
                        {
                            // Do nothing.
                        }

                        // All session sent failed and the item processed times less than 3.
                        else if(successCount == 0 && item.RetryCount < 3)
                        {
                            // Enqueue the message to the tail of the queue.
                            // And add retry count.
                            item.RetryCount += 1;
                            _messageQueue.Enqueue(item);
                        }

                        // The item processed times more than 3.
                        else if(item.RetryCount >= 3)
                        {
                            // Do nothing.
                            // Throw this message.
                            Console.WriteLine($"{item.ID}:{item.Message} => {item.Receiver}: Retried more than 3 times, still failed.");
                        }
                    }
                    else
                    {
                        // Do nothing.
                        // Throw this message because the user is not online.
                        Console.WriteLine($"{item.ID}:{item.Message} => {uid}, failed, because {uid} is not online.");
                    }
                }

                // If the queue is empty.
                // Process after 1 second.
                Thread.Sleep(1000);
            }
        }

    }
}
