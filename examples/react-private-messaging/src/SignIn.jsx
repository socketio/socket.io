import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Container,
  CssBaseline,
  FormControlLabel,
  Grid,
  Link,
  Typography,
  TextField,
} from "@mui/material";
import FaceIcon from "@mui/icons-material/Face";
import { useState } from "react";
import "./App.css";

{
  /* <Container component={"main"} maxWidth="xs">
      <CssBaseline />
      <Box
        sx={{
          marginTop: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Avatar sx={{ m: 1, bgcolor: "secondary.main" }}>
          <FaceIcon />
        </Avatar>
        <Typography component="h1" variant="h5">
          Sign in
        </Typography>
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="username"
            label="Username"
            name="username"
            autoFocus
            onChange={(e) => setUsername(e.target.value)}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
          >
            Sign In
          </Button>
        </Box>
      </Box>
    </Container> */
}

export default function SignIn({ onSignIn }) {
  const [username, setUsername] = useState();
  const handleSubmit = (e) => {
    e.preventDefault();
    if (username && username.length > 3) {
      onSignIn(username);
    }
  };

  return (
    <div className="paper-container">
      <div className="paper">
        <h3 className="paper-header">Sign In</h3>
        <form className="column-form" onSubmit={handleSubmit}>
          <input
            onChange={(e) => setUsername(e.target.value)}
            className="formgroup-input"
            id="username"
            name="username"
            type="text"
            placeholder="Username"
            required
          />
          <span></span>
          <button type="submit" className="formgroup-button">
            Register
          </button>
        </form>
      </div>
    </div>
  );
}
