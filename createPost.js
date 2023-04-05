async function createPost(db, caption, slides, files) {
    let db = await Connection.open(mongoUri, db);
    // here's the one line that does the query
    let result = await db.collection('posts').insertOne({"caption": caption,
                                                         "slides" : slides,
                                                         "files" : files}
                                                         );
    console.log(result);
    await Connection.close();
    console.log('post successfully uploaded!');
}