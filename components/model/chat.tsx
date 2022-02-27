import { Grid } from '@mui/material';
import {
  LocalAudioStream,
  SkyWayContext,
  Channel,
  LocalPerson,
  Publication,
  SkyWayChannel,
  RemoteMember,
  Subscription,
  LocalDataStream,
  LocalVideoStream,
} from '@skyway-sdk/core';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import MySelfUserItem from '../../components/model/mySelfUserItem';
import { RootState } from '../../store';
import fetch from 'node-fetch';
import UserItem from './userItem';
import { updateChatMessage } from '../../store/chat';
import { updateScreenStream } from '../../store/stream';
import { Forwarding, SfuBotMember, SfuClientPlugin } from '@skyway-sdk/sfu-client';

const Chat = () => {
  const roomName: string = useSelector((state: RootState) => state.room.room.name);
  const userName: string = useSelector((state: RootState) => state.user.user.name);
  const audioInputDevice = useSelector((state: RootState) => state.device.audioInput.deviceId);
  const sendMessage = useSelector((state: RootState) => state.chat.sendMessage);
  const currentScreenStream = useSelector((state: RootState) => state.stream.screen);
  const [localAudioStream, setLocalAudioStream] = useState<LocalAudioStream | null>(null);
  const [localDataStream, setLocalDataStream] = useState<LocalDataStream | null>(null);
  const [skywayChannel, setSkyWayChannel] = useState<Channel>();
  const [memberMySelf, setMemberMySelf] = useState<LocalPerson>();
  const [sfuBotMember, setSfuBotMember] = useState<SfuBotMember>();
  const [myAudioPublication, setAudioMyPublication] = useState<Publication<LocalAudioStream> | null>(null);
  const [myTextPublication, setMyTextPublication] = useState<Publication<LocalDataStream> | null>(null);
  const [myScreenPublication, setMyScreenPublication] = useState<Publication<LocalVideoStream> | null>(null);
  const [myScreenForwarding, setMyScreenForwarding] = useState<Forwarding | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [members, setMembers] = useState<RemoteMember[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const dispatch = useDispatch();

  useEffect(() => {
    let localStream: LocalAudioStream;
    const getAudioStream = async () => {
      const getAudioTrack = async () => {
        localAudioStream?.track.stop();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: { deviceId: audioInputDevice },
        });
        const [track] = stream.getAudioTracks();
        localStream = new LocalAudioStream('audio', track.clone());
        setLocalAudioStream(localStream);
        stream.getAudioTracks().forEach((t) => t.stop());
      };

      getAudioTrack();
    };
    getAudioStream();

    return () => {
      localStream.track.stop();
      setLocalAudioStream(null);
    };
  }, [audioInputDevice]);

  useEffect(() => {
    let context: SkyWayContext;
    let member: LocalPerson;
    let channel: Channel;
    (async () => {
      const authServerUrl = process.env.NEXT_PUBLIC_SKYWAY_AUTH_SERVER_URL || '';
      const res = await fetch(`${authServerUrl}?roomName=${roomName}`);
      const json = await res.json();
      const { token } = json;
      context = await SkyWayContext.Create(token, {
        logLevel: 'debug',
      });
      const plugin = new SfuClientPlugin();
      context.registerPlugin(plugin);
      channel = await SkyWayChannel.FindOrCreate(context, {
        name: roomName,
      });
      channel.onClosed.add(() => {
        console.log(`channel ${channel.name} closed`);
      });
      channel.onMemberJoined.add(({ member }) => {
        if (member.subtype !== SfuBotMember.subtype) {
          console.log(`member ${member.name} joined`);
          if (member.side === 'remote') {
            setMembers([...members, member as RemoteMember]);
          }
        }
      });
      channel.onMemberLeft.add(({ member }) => {
        console.log(`member ${member.name} left`);
        setMembers([...members.filter((m) => m.name !== member.name)]);
      });
      channel.onStreamPublished.add(async ({ publication }) => {
        console.log(`publication ${publication.id} ${publication.publisher.type} ${publication.contentType} published`);
        if (
          member &&
          publication.publisher.type === 'person' &&
          publication.publisher.name !== member.name &&
          publication.contentType !== 'video'
        ) {
          await member.subscribe(publication.id);
        } else if (
          member &&
          publication.publisher.subtype === SfuBotMember.subtype &&
          publication.origin?.publisher.name !== member.name &&
          publication.contentType === 'video'
        ) {
          await member.subscribe(publication.id);
        }
      });
      channel.onStreamUnpublished.add(async ({ publication }) => {
        console.log(`publication ${publication.id} unpublished`);
      });

      const alreadyExistBot = channel.members.find((m) => m.subtype === SfuBotMember.subtype) as SfuBotMember;
      if (alreadyExistBot) {
        setSfuBotMember(alreadyExistBot);
      } else {
        const bot = await plugin.createBot(channel);
        setSfuBotMember(bot);
      }

      member = await channel.join({
        name: userName,
        metadata: userName,
      });
      member.onJoined.add(() => {
        console.log(`member ${member.name} joined self`);
      });
      member.onLeft.add(() => {
        console.log(`member ${member.name} left self`);
      });
      member.onStreamSubscribed.add(({ subscription }) => {
        console.log(`member ${member.name} subscribed ${subscription.contentType} ${subscription.id}`);
        if (subscription && subscription.stream && subscription.stream.contentType === 'data') {
          subscription.stream.onData.add((data) => {
            dispatch(
              updateChatMessage({
                message: data as unknown as string,
                sender: subscription.publication.publisher.name || 'unknown',
                direction: 'incoming',
                sendTime: new Date().toLocaleTimeString(),
              })
            );
          });
        } else if (subscription && subscription.stream && subscription.stream.contentType === 'video') {
          dispatch(
            updateScreenStream({
              isSharing: false,
              stream: subscription.stream,
            })
          );
          return;
        }
        setSubscriptions([...subscriptions, subscription]);
      });
      member.onStreamUnsubscribed.add(({ subscription }) => {
        console.log(`member ${subscription.id} ${subscription.contentType} unsubscribed`);
        if (subscription.contentType === 'video') {
          dispatch(
            updateScreenStream({
              isSharing: false,
              stream: null,
            })
          );
        }
        setSubscriptions([...subscriptions.filter((s) => s.id !== subscription.id)]);
      });

      channel.publications.forEach(async (publication) => {
        if (member && publication.publisher.type === 'person' && publication.publisher.name !== member.name) {
          await member.subscribe(publication.id);
        } else if (
          member &&
          publication.publisher.subtype === SfuBotMember.subtype &&
          publication.origin?.publisher.name !== member.name
        ) {
          await member.subscribe(publication.id);
        }
      });

      setMembers([...channel.members.filter((m) => m.name !== userName && m.subtype !== SfuBotMember.subtype)]);
      setSkyWayChannel(channel);
      setMemberMySelf(member);
    })();

    return () => {
      localAudioStream?.track.stop();
      setLocalAudioStream(null);
      currentScreenStream.stream?.track.stop();
      dispatch(updateScreenStream({ isSharing: false, stream: null }));
      (async () => {
        await member.leave();
        if (channel.members.filter((m) => m.type === 'person').length === 0) {
          await channel.close();
        }
      })().finally(() => {
        context.dispose();
      });
    };
  }, []);

  useEffect(() => {
    if (isMuted) {
      if (skywayChannel && memberMySelf) {
        if (myAudioPublication) {
          memberMySelf.unpublish(myAudioPublication.id);
        }
        if (myTextPublication) {
          memberMySelf.unpublish(myTextPublication.id);
        }
      }
    } else {
      if (skywayChannel && memberMySelf) {
        if (localAudioStream) {
          memberMySelf.publish(localAudioStream).then((publication) => {
            setAudioMyPublication(publication);
          });
        }
        const localDataStream = new LocalDataStream();
        setLocalDataStream(localDataStream);
        memberMySelf.publish(localDataStream).then((publication) => {
          setMyTextPublication(publication);
        });
      }
    }
  }, [isMuted]);

  useEffect(() => {
    if (sendMessage) {
      localDataStream?.write(sendMessage.message);
    }
  }, [sendMessage]);

  const handleChangeMute = () => {
    setIsMuted(!isMuted);
  };

  const handleChangeShareScreen = () => {
    (async () => {
      // 自分が画面共有中
      if (currentScreenStream.isSharing) {
        await myScreenPublication?.cancel();
        currentScreenStream.stream.track.stop();
        dispatch(updateScreenStream({ isSharing: false, stream: null }));
        setMyScreenPublication(null);
        setMyScreenForwarding(null);
      } else {
        // channel内の誰も画面共有をしていない
        if (!currentScreenStream.stream) {
          const stream = await navigator.mediaDevices.getDisplayMedia();
          const [track] = stream.getVideoTracks();
          track.addEventListener('ended', async () => {
            dispatch(updateScreenStream({ isSharing: false, stream: null }));
            await myScreenPublication?.cancel();
            setMyScreenPublication(null);
            setMyScreenForwarding(null);
          });
          const screenStream = new LocalVideoStream('screen', track);
          dispatch(updateScreenStream({ isSharing: true, stream: screenStream }));
          const screenPublication = await memberMySelf?.publish(screenStream);
          if (screenPublication && sfuBotMember) {
            setMyScreenPublication(screenPublication);
            const forwarding = await sfuBotMember.startForwarding(screenPublication);
            setMyScreenForwarding(forwarding);
          }
        } else {
          console.info('他の誰かがすでに画面を共有しています');
        }
      }
    })();
  };

  return (
    <div>
      <Grid container spacing={2} padding={1}>
        <Grid item xs={6} lg={3}>
          <MySelfUserItem
            name={userName}
            onChangeMute={handleChangeMute}
            onChangeShareScreen={handleChangeShareScreen}
          ></MySelfUserItem>
        </Grid>
        {members.map((m, i) => {
          return (
            <Grid item xs={6} lg={3} key={i}>
              <UserItem
                name={m.name || ''}
                subscription={subscriptions.find((s) => s.publication.publisher.name === m.name)}
              ></UserItem>
            </Grid>
          );
        })}
      </Grid>
    </div>
  );
};

export default Chat;
