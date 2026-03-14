"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Send, UserCircle, MessageSquareText, Loader2, Trash2 as TrashIcon, Bot } from 'lucide-react';
import type { FirestoreUser, ChatMessage, ChatSession, FirestoreNotification } from '@/types/firestore';
import { Timestamp, doc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, setDoc, serverTimestamp, getDoc, getDocs, limit, writeBatch, deleteDoc } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { ADMIN_EMAIL } from '@/contexts/AuthContext';
import { triggerPushNotification } from '@/lib/fcmUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface AdminChatMessageAreaProps {
  selectedUser: FirestoreUser | null;
}

const ADMIN_FALLBACK_AVATAR_INITIAL_CHAT_AREA = "S";

const linkify = (text: string) => {
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(urlRegex, (url) => {
        const fullUrl = url.startsWith('www.') ? `http://${url}` : url;
        return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:text-primary/80">${url}</a>`;
    });
};

export default function AdminChatMessageArea({ selectedUser }: AdminChatMessageAreaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [isAiActive, setIsAiActive] = useState(true);
  const [isUpdatingAi, setIsUpdatingAi] = useState(false);
  const scrollAreaRootRef = useRef<HTMLDivElement>(null);
  const { user: loggedInAdminUser } = useAuth();
  const { toast } = useToast();

  const [supportAdminProfile, setSupportAdminProfile] = useState<{displayName?: string | null, photoURL?: string | null, uid: string | null}>({
    displayName: "Support", photoURL: null, uid: null
  });
  const [isLoadingSupportAdminProfile, setIsLoadingSupportAdminProfile] = useState(true);

  useEffect(() => {
    const fetchSupportAdminProfile = async () => {
      setIsLoadingSupportAdminProfile(true);
      try {
        const adminQuery = query(collection(db, "users"), where("email", "==", ADMIN_EMAIL), limit(1));
        const adminSnapshot = await getDocs(adminQuery);
        if (!adminSnapshot.empty) {
          const adminData = adminSnapshot.docs[0].data();
          const adminUid = adminSnapshot.docs[0].id;
          setSupportAdminProfile({
            displayName: adminData.displayName || "Support",
            photoURL: adminData.photoURL || null,
            uid: adminUid
          });
        } else {
          setSupportAdminProfile({ displayName: "Support", photoURL: null, uid: 'fallback_admin_uid' });
        }
      } catch (error) {
        setSupportAdminProfile({ displayName: "Support", photoURL: null, uid: 'fallback_admin_uid' });
      } finally {
        setIsLoadingSupportAdminProfile(false);
      }
    };
    fetchSupportAdminProfile();
  }, []);

  const getChatSessionId = useCallback((userId1: string, userId2: string): string => {
    return [userId1, userId2].sort().join('_');
  }, []);

  const currentChatSessionId = selectedUser && supportAdminProfile.uid ? getChatSessionId(selectedUser.id, supportAdminProfile.uid) : null;

  useEffect(() => {
    if (currentChatSessionId && selectedUser && !isLoadingSupportAdminProfile) {
      setIsLoadingMessages(true);
      
      // Listen to chat session for AI status
      const sessionDocRef = doc(db, 'chats', currentChatSessionId);
      const unsubSession = onSnapshot(sessionDocRef, (docSnap) => {
          if (docSnap.exists()) {
              const data = docSnap.data() as ChatSession;
              setIsAiActive(data.aiAgentActive !== false); // Default to true if not specified
          }
      });

      const messagesRef = collection(db, 'chats', currentChatSessionId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));

      const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        const fetchedMessages = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ChatMessage));
        setMessages(fetchedMessages);
        setIsLoadingMessages(false);

        const batch = writeBatch(db);
        let messagesMarkedRead = false;
        for (const msg of fetchedMessages) {
          if (msg.senderType === 'user' && !msg.isReadByAdmin && msg.id) {
            const msgRef = doc(db, 'chats', currentChatSessionId, 'messages', msg.id);
            batch.update(msgRef, { isReadByAdmin: true });
            messagesMarkedRead = true;
          }
        }
        if (messagesMarkedRead) {
          await batch.commit();
        }

        if (selectedUser && supportAdminProfile.uid) {
            await setDoc(sessionDocRef, {
                userId: selectedUser.id,
                adminId: supportAdminProfile.uid,
                adminUnreadCount: 0,
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                participants: [selectedUser.id, supportAdminProfile.uid].filter(Boolean),
            }, { merge: true });
        }
      }, (error) => {
        console.error("AdminChatMessageArea: Error fetching messages:", error);
        setIsLoadingMessages(false);
      });

      return () => {
          unsubscribe();
          unsubSession();
      };
    } else {
      setMessages([]);
      if (!isLoadingSupportAdminProfile) setIsLoadingMessages(false);
    }
  }, [currentChatSessionId, selectedUser, isLoadingSupportAdminProfile, supportAdminProfile.uid]);

  useEffect(() => {
    if (scrollAreaRootRef.current) {
      const viewport = scrollAreaRootRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, isLoadingMessages]);

  const handleToggleAi = async (checked: boolean) => {
      if (!currentChatSessionId) return;
      setIsUpdatingAi(true);
      try {
          const sessionDocRef = doc(db, 'chats', currentChatSessionId);
          await updateDoc(sessionDocRef, { aiAgentActive: checked, updatedAt: serverTimestamp() });
          toast({ 
              title: checked ? "AI Agent Enabled" : "AI Agent Disabled", 
              description: `The bot is now ${checked ? 'managing' : 'paused for'} this conversation.` 
          });
      } catch (error) {
          console.error("Error toggling AI status:", error);
          toast({ title: "Update Failed", description: "Could not update bot status.", variant: "destructive" });
      } finally {
          setIsUpdatingAi(false);
      }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || !loggedInAdminUser || !currentChatSessionId || !supportAdminProfile.uid) {
      return;
    }

    const messageData: Omit<ChatMessage, 'id'> = {
      chatSessionId: currentChatSessionId,
      senderId: supportAdminProfile.uid,
      senderType: 'admin',
      text: newMessage,
      timestamp: Timestamp.now(),
      isReadByUser: false, 
    };

    const tempNewMessage = newMessage;
    setNewMessage('');
    try {
      const messagesRef = collection(db, 'chats', currentChatSessionId, 'messages');
      await addDoc(messagesRef, messageData);

      const sessionDocRef = doc(db, 'chats', currentChatSessionId);
      const sessionSnap = await getDoc(sessionDocRef);
      const currentSessionData = sessionSnap.exists() ? sessionSnap.data() as ChatSession : undefined;
      const currentUserUnreadCount = currentSessionData?.userUnreadCount || 0;

      await setDoc(sessionDocRef, {
        userId: selectedUser.id,
        userName: selectedUser.displayName || null,
        userPhotoUrl: selectedUser.photoURL || null,
        adminId: supportAdminProfile.uid,
        adminName: supportAdminProfile.displayName || null,
        adminPhotoUrl: supportAdminProfile.photoURL || null,
        lastMessageText: tempNewMessage.substring(0, 50),
        lastMessageTimestamp: messageData.timestamp,
        lastMessageSenderId: supportAdminProfile.uid,
        participants: [selectedUser.id, supportAdminProfile.uid].filter(p => p !== null && p !== undefined),
        userUnreadCount: currentUserUnreadCount + 1,
        adminUnreadCount: 0,
        aiAgentActive: false, // Explicitly set to false on manual message
        updatedAt: messageData.timestamp,
        ...(currentSessionData ? {} : { createdAt: messageData.timestamp })
      }, { merge: true });
      
      const userNotificationData: FirestoreNotification = {
        userId: selectedUser.id,
        title: `New Message from ${supportAdminProfile.displayName || "Support"}`,
        message: `You have a new chat message: "${tempNewMessage.substring(0, 30)}${tempNewMessage.length > 30 ? "..." : ""}"`,
        type: 'info',
        href: '/chat',
        read: false,
        createdAt: Timestamp.now(),
      };
      await addDoc(collection(db, "userNotifications"), userNotificationData);

      triggerPushNotification({
        userId: selectedUser.id,
        title: `Message from ${supportAdminProfile.displayName || "Support"}`,
        body: tempNewMessage,
        href: '/chat'
      });

    } catch (error) {
      console.error("AdminChatMessageArea: Error sending message:", error);
    }
  };

  const handleClearChat = async () => {
    if (!currentChatSessionId || !selectedUser) {
      toast({ title: "Error", description: "No chat session selected to clear.", variant: "destructive" });
      return;
    }
    setIsClearingChat(true);
    try {
      const messagesQuery = query(collection(db, 'chats', currentChatSessionId, 'messages'));
      const messagesSnapshot = await getDocs(messagesQuery);
      
      const batch = writeBatch(db);
      messagesSnapshot.forEach(docSnapshot => {
        batch.delete(docSnapshot.ref);
      });

      const sessionDocRef = doc(db, 'chats', currentChatSessionId);
      batch.update(sessionDocRef, {
        lastMessageText: "Chat cleared by admin.",
        lastMessageTimestamp: serverTimestamp(),
        lastMessageSenderId: supportAdminProfile.uid || null,
        userUnreadCount: 0,
        adminUnreadCount: 0,
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      toast({ title: "Chat Cleared", description: `Message history with ${selectedUser.displayName || selectedUser.email} has been cleared.` });
    } catch (error) {
      console.error("Error clearing chat:", error);
      toast({ title: "Error Clearing Chat", description: (error as Error).message || "Could not clear chat history.", variant: "destructive" });
    } finally {
      setIsClearingChat(false);
    }
  };


  if (!selectedUser) {
    return (
      <Card className="h-full flex flex-col items-center justify-center text-center shadow-md">
        <CardContent className="p-6">
          <MessageSquareText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Select a user from the list to view their chat history or send a message.</p>
        </CardContent>
      </Card>
    );
  }

  if (!loggedInAdminUser || isLoadingSupportAdminProfile || !supportAdminProfile.uid) {
    return <Card className="h-full flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin mr-2"/> <p className="text-muted-foreground">Loading admin details...</p></Card>;
  }

  return (
    <Card className="h-full flex flex-col shadow-md">
      <CardHeader className="p-4 border-b">
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedUser.photoURL || undefined} alt={selectedUser.displayName || selectedUser.email?.charAt(0) || 'U'} />
                  <AvatarFallback>
                      {selectedUser.displayName ? selectedUser.displayName.charAt(0).toUpperCase() : selectedUser.email ? selectedUser.email.charAt(0).toUpperCase() : <UserCircle size={20}/>}
                  </AvatarFallback>
              </Avatar>
              <div>
                  <CardTitle className="text-md">{selectedUser.displayName || selectedUser.email}</CardTitle>
                  <div className="flex items-center space-x-2 mt-1">
                      <div className={`h-2 w-2 rounded-full ${isAiActive ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight">
                        {isAiActive ? 'Bot Assistant Active' : 'Admin Mode Only'}
                      </span>
                  </div>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2 bg-muted/50 px-3 py-1.5 rounded-full border">
                <Bot className={`h-4 w-4 ${isAiActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <Label htmlFor="ai-toggle" className="text-xs font-semibold cursor-pointer select-none">AI Agent</Label>
                <Switch 
                  id="ai-toggle" 
                  checked={isAiActive} 
                  onCheckedChange={handleToggleAi} 
                  disabled={isUpdatingAi}
                />
              </div>

              <AlertDialog>
              <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={isClearingChat || isLoadingMessages || messages.length === 0}>
                  {isClearingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrashIcon className="h-4 w-4" />}
                  <span className="ml-2 hidden lg:inline">Clear</span>
                  </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                  <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Clear Chat</AlertDialogTitle>
                  <AlertDialogDescription>
                      Are you sure you want to permanently delete all messages with {selectedUser.displayName || selectedUser.email}?
                  </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                  <AlertDialogCancel disabled={isClearingChat}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearChat} disabled={isClearingChat} className="bg-destructive hover:bg-destructive/90">
                      {isClearingChat && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Yes, Clear Chat
                  </AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
              </AlertDialog>
            </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-grow overflow-hidden">
        <ScrollArea className="h-full p-4" ref={scrollAreaRootRef}>
          {isLoadingMessages ? (
             <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : messages.length === 0 ? (
             <div className="flex justify-center items-center h-full">
                <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
             </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-end space-x-2 ${
                    msg.senderType === 'admin' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.senderType === 'user' && (
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={selectedUser.photoURL || undefined} />
                      <AvatarFallback>{selectedUser.displayName ? selectedUser.displayName.charAt(0).toUpperCase() : selectedUser.email ? selectedUser.email.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                    </Avatar>
                  )}
                   {msg.senderType === 'ai' && (
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold">
                        <Bot className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-[75%] p-2.5 rounded-lg shadow-sm ${
                      msg.senderType === 'admin'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-secondary text-secondary-foreground border border-border/40 rounded-bl-none'
                    }`}
                  >
                    {msg.text && <p className="text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: linkify(msg.text) }}></p>}
                    <p className={`text-[10px] mt-1 text-right ${msg.senderType === 'admin' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {msg.senderType === 'admin' && (
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={supportAdminProfile?.photoURL || undefined} />
                      <AvatarFallback>{supportAdminProfile?.displayName ? supportAdminProfile.displayName.charAt(0).toUpperCase() : ADMIN_FALLBACK_AVATAR_INITIAL_CHAT_AREA}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t">
        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-grow h-10"
            autoComplete="off"
            disabled={isLoadingMessages || isLoadingSupportAdminProfile}
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim() || isLoadingMessages || isLoadingSupportAdminProfile}>
            <Send className="h-5 w-5" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
