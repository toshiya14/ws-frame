using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TestWebSocketServer
{
    public class SessionCache
    {
        Dictionary<string, string> _sessionCache;

        public SessionCache() {
            _sessionCache = new Dictionary<string, string>();
        }

        public void BindUserID(string sessionId, string userId) {
            _sessionCache[sessionId] = userId;
        }

        public string GetUserID(string sessionID)
        {
            if(_sessionCache.ContainsKey(sessionID))
            {
                return _sessionCache[sessionID];
            }
            else
            {
                return null;
            }
        }

        public IEnumerable<string> GetSessionID(string userID)
        {
            return from kv in _sessionCache where kv.Value == userID select kv.Key;
        }

        public void CloseSession(string sessionId)
        {
            _sessionCache.Remove(sessionId);
        }
    }
}
