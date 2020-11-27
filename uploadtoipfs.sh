mkdir build
cp -r src build/
cp -r dist build/
cp index.html build/
cp index.css build/
node tools/ipfs-upload/bin/upload-remix-plugin /Volumes/butbut/code/remix-3box-plugin/build/ --profile-path /Volumes/butbut/code/remix-3box-plugin/profile.json