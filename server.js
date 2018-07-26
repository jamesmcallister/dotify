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

app.patch("selectArtists", (req, res) => {
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

// // working
// app.delete("/api/artists/:id", (req, res) => {
//   const { id } = req.params;
//   db.none(
//     `
//     DELETE FROM song_playlist USING song
//     WHERE song.id = song_playlist.song_id
//     AND song.artist_id = $1;

//     DELETE FROM song
//     WHERE song.artist_id = $1;

//     DELETE FROM artist
//     WHERE artist.id = $1;
//   `,
//     [id]
//   )
//     .then(() => res.json({ message: "cazzo, iho cancellato" }))

//     .catch(error => res.json({ error: error.message }));
// });

// new transations
app.delete("/api/artists/:id", (req, res) => {
  const { id } = req.params;
  db.tx(t => {
    const step1 = t.none(
      `DELETE FROM song_playlist USING song 
      WHERE song.id = song_playlist.song_id
      AND song.artist_id = $1`,
      [id]
    );

    const step2 = t.none(
      `DELETE FROM song
      WHERE song.artist_id = $2`,
      [id]
    );

    const step3 = t.none(
      `DELETE FROM artist
      WHERE artist.id = $1`,
      [id]
    );
    return t.batch([step1, step2, step3]);
  })
    .then(() => res.json({ message: "cazzo, iho cancellato" }))

    .catch(error => res.json({ error: error.message }));
});

const QUERY_TO_DELETE_AND_RECREATE_EVERYTHING = `
DROP TABLE song_playlist;
DROP TABLE song;
DROP TABLE artist;
DROP TABLE playlist;

CREATE TABLE artist (
    id serial,
    name varchar(50) NOT NULL,
    email varchar(50) NOT NULL UNIQUE,
    PRIMARY KEY (id)
);
CREATE TABLE song (
    id SERIAL,
    artist_id INT,
    title VARCHAR(50) NOT NULL,
    year SMALLINT NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (artist_id) REFERENCES artist (id)
);
INSERT INTO artist VALUES (1, 'The Doors', 'jim@thedoors.com');
INSERT INTO artist VALUES (2, 'The Kinks', 'ray@thekinks.com');
ALTER SEQUENCE artist_id_seq RESTART WITH 3 INCREMENT BY 1;

INSERT INTO song VALUES (1, 1, 'Riders On The Storm', 1971);
INSERT INTO song VALUES (2, 1, 'Light My Fire', 1967);
INSERT INTO song VALUES (3, 1, 'Break On Through', 1967);
INSERT INTO song VALUES (4, 2, 'Lola', 1970);
INSERT INTO song VALUES (5, 2, 'Waterloo Sunset', 1967);
INSERT INTO song VALUES (6, 2, 'Sunny Afternoon', 1966);
ALTER SEQUENCE song_id_seq RESTART WITH 7 INCREMENT BY 1;
`;

app.get("/api/WARNGIN", (req, res) => {
  db.none(QUERY_TO_DELETE_AND_RECREATE_EVERYTHING)
    .then(() => res.json({ message: "WHOO, you droped and recreted" }))
    .catch(error => res.json({ error: error.message }));
});

app.get("*", (req, res) => {
  res.send("caio, come sta, cazzo voi");
});

app.listen(EXPRESS_PORT, function() {
  console.log(`listening to port ${EXPRESS_PORT}!`);
});
