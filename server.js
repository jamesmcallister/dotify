const pgp = require("pg-promise")();
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
app.use(bodyParser.json());
const {
  DATABASE,
  DATABASE_USERNAME,
  DATABASE_PASSWORD,
  EXPRESS_PORT,
  DATABASE_PORT
} = process.env;
// @ts-ignore
const db = pgp({
  host: "localhost",
  port: DATABASE_PORT,
  database: DATABASE,
  user: DATABASE_USERNAME,
  password: DATABASE_PASSWORD
});

app.get("/songs", (req, res) => {
  db.any("SELECT * FROM song, artist")
    .then(data => res.json(data))
    .catch(error => res.json({ error: error.message }));
});
app.get("/songs/:id", (req, res) => {
  const id = req.params.id;
  db.any("SELECT * FROM song WHERE id=$1", [id])
    .then(data => res.json(data))
    .catch(error => res.json({ error: error.message }));
});

app.get("/api/artists", (req, res) => {
  db.any(`SELECT * FROM artist`)
    .then(data => res.json(data))
    .catch(error => res.json({ error: error.message }));
});

app.get("/api/songs", (req, res) => {
  db.any(
    `
    SELECT artist.name, song.id, song.title, song.year
    FROM artist, song
    WHERE artist.id = song.artist_id`
  )
    .then(data => res.json(data))
    .catch(error => res.json({ error: error.message }));
});

app.get("/api/playlist", (req, res) => {
  db.any(
    `
    SELECT playlist.id,playlist.name 
    FROM playlist
    `
  )
    .then(data => res.json(data))
    .catch(error => res.json({ error: error.message }));
});

app.get("/api/songs/:id", (req, res) => {
  const id = req.params.id;
  db.one(
    `select song.id, artist.name, song.title
  from song, artist
  where song.artist_id = artist.id
  and song.id = $1`,
    [id]
  )
    .then(data => res.json(data))
    .catch(error => res.json({ error: error.message }));
});

app.get("/api/playlist/:id", (req, res) => {
  const id = req.params.id;
  let newData;
  db.any(
    `
    SELECT playlist.id, playlist.name
    FROM playlist
    WHERE playlist.id = $1
    `,
    [id]
  )
    .then(dataFromFirstQuery =>
      db
        .any(
          `
          SELECT song.id as song_id, artist.name as artist_name, song.title
          FROM song_playlist, song, artist
          WHERE song_playlist.playlist_id = $1
          AND song_playlist.song_id = song.id
          AND song.artist_id = artist.id
       `,
          [dataFromFirstQuery[0].id]
        )
        .then(data => {
          newData = dataFromFirstQuery;
          return data;
        })
    )

    .then(data =>
      res.json(Object.assign({}, { ...newData[0] }, { songs: data }))
    )
    .catch(error => res.json({ error: error.message }));
});

app.post("/api/artists", (req, res) => {
  const { artistName, artistEmail } = req.body;
  db.one(
    `INSERT INTO artist(name, email)
          VALUES($1, $2) RETURNING id`,
    [artistName, artistEmail]
  )
    .then(data => res.json(Object.assign({}, { id: data.id }, req.body)))
    .catch(error => res.json({ error: error.message }));
});

app.post("/api/playlist", (req, res) => {
  const { playlistName } = req.body;
  db.one(
    `
  INSERT INTO playlist(name)
  VALUES($1) RETURNING id, name
  `,
    [playlistName]
  )
    .then(data => res.json(Object.assign({}, { ...data })))
    .catch(error => res.json({ error: error.message }));
});

app.post("/api/playlists/:playlistId/songs", (req, res) => {
  const { playlistId } = req.params;
  const { songId } = req.body;
  db.one(
    `INSERT INTO song_playlist(song_id, playlist_id)
  VALUES($1, $2) RETURNING id, song_id, playlist_id`,
    [songId, playlistId]
  )
    .then(data => res.json(data))
    .catch(error => res.json({ error: error.message }));
});

app.patch("/api/artists/:id", (req, res) => {
  const { name, email } = req.body;
  const { id } = req.params;
  db.one(
    `
    UPDATE artist 
    SET name = $1, email = $2
    WHERE id = $3
    RETURNING name, email, id
  `,
    [name, email, id]
  )
    .then(data => res.json(data))
    .catch(error => res.json({ error: error.message }));
});

app.patch("/api/playlist/:id", (req, res) => {
  const { name } = req.body;
  const { id } = req.params;
  db.one(
    `
    UPDATE playlist 
    SET name = $1
    WHERE id = $2
    RETURNING name, id
  `,
    [name, id]
  )
    .then(data => res.json(data))
    .catch(error => res.json({ error: error.message }));
});

app.delete("/api/playlists/:id/songs/:songId", (req, res) => {
  const { id, songId } = req.params;
  db.one(
    `
    DELETE FROM song_playlist 
    WHERE song_id = $1
    AND playlist_id = $2
  `,
    [songId, id]
  )
    .then(data => res.json(data))
    .catch(error => res.json({ error: error.message }));
});

app.delete("/api/playlists/:id", (req, res) => {
  const { id } = req.params;
  db.one(
    `
    DELETE FROM song_playlist 
    WHERE playlist_id = $1;
    DELETE FROM playlist
    WHERE id = $1
  `,
    [id]
  )
    .then(data => res.json(data))
    .catch(error => res.json({ error: error.message }));
});

app.delete("/api/song/:id", (req, res) => {
  const { id } = req.params;
  db.one(
    `
    DELETE FROM song_playlist 
    WHERE song_id = $1;
    DELETE FROM song
    WHERE id = $1
  `,
    [id]
  )
    .then(data => res.json(data))
    .catch(error => res.json({ error: error.message }));
});

// app.delete("/api/artists/:id", (req, res) => {
//   const { id } = req.params;
//   db.any(
//     `
//     SELECT song.id
//     FROM song, artist
//     WHERE artist.id = $1
//   `,
//     [id]
//   )
//     .then(data =>
//       data.map(song => {
//         db.any(
//           `
//         DELETE song_playlist
//         FROM song_playlist
//         WHERE song_playlist.song_id = $1
//       `,
//           [song.id]
//         ).then(data =>
//           db
//             .any(
//               `
//         DELETE song
//         FROM song, artist
//         WHERE artist.id = $1
//         `,
//               [id]
//             )
//             .then(data => res.json({ data: "woohoo" }))
//             .catch(error => res.json({ error: error.message }))
//         );
//       })
//     )
//     .catch(error => res.json({ error: error.message }));
// });

app.get("*", (req, res) => {
  res.send("caio, come sta, cazzo voi");
});

app.listen(EXPRESS_PORT, function() {
  console.log(`listening to port ${EXPRESS_PORT}!`);
});
