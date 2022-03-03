import { FormControl, TextField } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { updateRoomName } from '../../store/room';
import { themeOptions } from '../../styles/theme';

const RoomNameTextInput = () => {
  const currentRoomName = useSelector((state: RootState) => state.room.room.name);
  const dispatch = useDispatch();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(updateRoomName(e.target.value));
  };

  return (
    <FormControl>
      <TextField
        onChange={handleChange}
        label="Room名"
        color="info"
        value={currentRoomName}
        required
        sx={{
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: themeOptions.palette?.text?.primary,
            },
          },
        }}
        InputLabelProps={{ style: { color: themeOptions.palette?.text?.primary } }}
      ></TextField>
    </FormControl>
  );
};

export default RoomNameTextInput;
