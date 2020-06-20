import React, { useState, useRef, useEffect } from 'react';
import { Button, Grid, List, ListItem, ListItemText, Input, Divider } from '@material-ui/core';

type ChatMessage = {
    user: string,
    message: string
};
type TextChatProps = {
    chatMessages: ChatMessage[],
    sendChatMessage: any
}

const TextChat = (props: TextChatProps) => {
    const [sendMessage, setSendMessage] = useState('');
    const chatMessagesCount = props.chatMessages.length - 1;
    const chatMessagesLastItem = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatMessagesLastItem) {
            if (chatMessagesLastItem.current) {
                chatMessagesLastItem.current.scrollIntoView({ behavior: "smooth" });
            }
        }
    }, [props.chatMessages]);
    return (
        <Grid container style={{ height: '100%', paddingLeft: '8px', paddingRight: '8px' }}>
            <Grid item xs={12} style={{ overflowY: 'scroll', height: '90%' }}>
                <List>
                    {props.chatMessages.map((msg, i) => {
                        if (i === chatMessagesCount) {
                            return (
                                <ListItem key={i} divider>
                                    <ListItemText
                                        primary={msg.user}
                                        secondary={msg.message}
                                        ref={chatMessagesLastItem}
                                        style={{
                                            overflowWrap: 'break-word'
                                        }}
                                    ></ListItemText>
                                </ListItem>
                            );
                        }
                        return (
                            <ListItem key={i} divider>
                                <ListItemText
                                    primary={msg.user}
                                    secondary={msg.message}
                                    style={{
                                        overflowWrap: 'break-word'
                                    }}
                                ></ListItemText>
                            </ListItem>
                        );
                    })}
                </List>
            </Grid>
            <Grid item xs={12} style={{ height: '1%' }}>
                <Divider></Divider>
            </Grid>
            <Grid item xs={10} style={{ height: '9%', paddingRight: '4px' }}>
                <Input fullWidth value={sendMessage} onChange={e => setSendMessage(e.target.value)}></Input>
            </Grid>
            <Grid item xs={2} style={{ height: '9%' }}>
                <Button fullWidth color='primary' variant='contained' onClick={() => { props.sendChatMessage(sendMessage); setSendMessage('') }}>送信</Button>
            </Grid>
        </Grid>
    );
};

export default TextChat;