/* eslint-disable no-shadow */
/* eslint-disable no-param-reassign */
import { storage, database } from '@/plugins/firebase';
import Vue from 'vue';

const state = () => ({
  fetchedFiles: {},
  pathFiles: {},
  archivedFiles: {},
  currentPath: 'root',
});

const actions = {
  nuxtServerInit(vueContext) {
    return database.ref('root').once('value', (snap) => {
      vueContext.commit('SET_FILES_DATA', snap.val());
    });
  },
  fetchPathFiles(context, { path }) {
    return database.ref(path).once('value', (snap) => {
      context.commit('SET_PATH_FILES', snap.val());
    });
  },
  fetchArchivedFiles(context) {
    return database.ref('archives').once('value', (snap) => {
      context.commit('SET_ARCHIVE_DATA', snap.val());
    });
  },
  uploadFile(context, e) {
    if (e.target.files.length === 0) {
      return;
    }

    const file = e.target.files[0];
    const { size } = e.target.files[0];
    const { currentPath } = context.state;
    const storageRef = storage.ref(`${currentPath}/${file.name}`);
    const databaseRef = currentPath.replace(/\//g, '-');

    storageRef.put(file)
      .then(() => {
        storageRef.getDownloadURL()
          .then((snap) => {
            const pushRef = database.ref(`${databaseRef}`).push();
            const data = {
              downloadURL: snap,
              type: 'file',
              fileName: file.name,
              name: file.name,
              storagePath: `${currentPath}/${file.name}`,
              path: currentPath,
              updateTime: new Date().getTime(),
              key: pushRef.key,
              size,
              archive: false,
            };

            context.commit('ADD_FILES_DATA', data);
            pushRef.set(data);
          });
      });
  },
  createNewFolder(context, { folderName }) {
    const { currentPath } = context.state;
    const currentPathRef = currentPath.replace(/\//, '-');
    const data = {
      folderName,
      name: folderName,
      type: 'folder',
      path: `${currentPath}/${folderName}`,
      updateTime: new Date().getTime(),
      archive: false,
    };

    return database.ref(`${currentPathRef}/${data.folderName}`)
      .set(data)
      .then(() => {
        context.commit('ADD_FOLDER_DATA', data);
        const newDatabaseRef = data.path.replace(/\//g, '-');
        database.ref(`/${newDatabaseRef}/init`).set(true);
      });
  },
  deleteFile(context, file) {
    const storageRef = storage.ref();
    const { path, storagePath, key } = file;
    const databasePathRef = path.replace(/\//g, '-');

    database.ref(`${databasePathRef}/${key}`).remove()
      .then(() => {
        storageRef.child(storagePath).delete();
        context.commit('REMOVE_FILES_DATA', key);
      });
  },
  deleteFolder(context, folder) {
    const { path, folderName } = folder;
    const databasePathRef = path.replace(/\//g, '-');

    database.ref(path).remove()
      .then(() => {
        context.commit('REMOVE_FILES_DATA', folderName);
        database.ref(`${databasePathRef}`).remove();
      });
  },
  toggleArchive(context, file) {
    // const databasePathRef = context.state.currentPath.replace(/\//g, '-');
    const { key, archive, storagePath } = file;
    const storagePathArray = storagePath.split('/');
    storagePathArray.pop();
    const path = storagePathArray.join('-');

    database.ref(`${path}/${key}/archive`)
      .set(!archive)
      .then(() => {
        context.commit('SET_FILES_ARCHIVE', { key, archive });
      });

    if (archive) {
      database.ref(`archives/${key}`).remove();
      context.commit('REMOVE_LOCAL_ARCHIVE', { key });
    } else {
      const uploadFile = { ...file };
      uploadFile.archive = true;
      database.ref(`archives/${key}`).set(uploadFile);
    }
  },
  toggleArchiveFolder(context, folder) {
    const { folderName, archive, path } = folder;
    // Toggle the Archive value of Database
    database.ref(`${path}/archive`)
      .set(!archive)
      .then(() => {
        context.commit('SET_FOLDER_ARCHIVE', { folderName, archive });
      });
    // Adding or removing the folder info in the DB(archives/)
    if (archive) {
      const databaseArchivePathRef = path.replace(/\//g, '-');
      database.ref(`archives/${databaseArchivePathRef}`).remove();
      context.commit('REMOVE_LOCAL_ARCHIVE', { key: databaseArchivePathRef });
    } else {
      const databaseArchivePathRef = path.replace(/\//g, '-');
      const uploadFolder = { ...folder };
      uploadFolder.archive = true;
      database.ref(`archives/${databaseArchivePathRef}`).set(uploadFolder);
    }
  },
  updateCurrentPath(context, newPath) {
    context.commit('UPDATE_PATH', newPath);
  },
};

const mutations = {
  SET_FILES_DATA(state, data) {
    state.fetchedFiles = data;
  },
  SET_PATH_FILES(state, data) {
    state.pathFiles = data;
  },
  SET_ARCHIVE_DATA(state, data) {
    state.archivedFiles = data;
  },
  REMOVE_LOCAL_ARCHIVE(state, { key }) {
    if (!state.archivedFiles) {
      return;
    }
    if (state.archivedFiles[key]) {
      Vue.delete(state.archivedFiles, key);
    }
  },
  ADD_FILES_DATA(state, data) {
    const currentPath = this.$router.app.$route.params.path || 'root';

    if (!state.fetchedFiles) {
      this.dispatch('nuxtServerInit');
    } else if (currentPath === 'root') {
      Vue.set(state.fetchedFiles, data.key, data);
    } else {
      Vue.set(state.pathFiles, data.key, data);
    }
  },
  REMOVE_FILES_DATA(state, key) {
    const currentPath = this.$router.app.$route.params.path || 'root';
    if (currentPath === 'root') {
      Vue.delete(state.fetchedFiles, key);
    } else {
      Vue.delete(state.pathFiles, key);
    }
  },
  SET_FILES_ARCHIVE(state, { key, archive }) {
    if (state.currentPath === 'root') {
      state.fetchedFiles[key].archive = !archive;
    } else {
      state.pathFiles[key].archive = !archive;
    }
  },
  SET_FOLDER_ARCHIVE(state, { folderName, archive }) {
    if (state.currentPath === 'root') {
      state.fetchedFiles[folderName].archive = !archive;
    } else {
      state.pathFiles[folderName].archive = !archive;
    }
  },
  ADD_FOLDER_DATA(state, data) {
    const currentPath = this.$router.app.$route.params.path || 'root';

    if (!state.fetchedFiles) {
      this.dispatch('nuxtServerInit');
    } else if (currentPath === 'root') {
      Vue.set(state.fetchedFiles, data.folderName, data);
    } else {
      Vue.set(state.pathFiles, data.folderName, data);
    }
  },
  UPDATE_PATH(state, newPath) {
    state.currentPath = newPath;
  },
};

const getters = {
  fetchedFiles(state) {
    return state.fetchedFiles;
  },
  pathFiles(state) {
    return state.pathFiles;
  },
  archivedFiles(state) {
    return state.archivedFiles;
  },
  rootFileNames(state) {
    const fileNames = [];
    Object.keys(state.fetchedFiles)
      .forEach((key) => {
        if (state.fetchedFiles[key].type === 'file') {
          fileNames.push(state.fetchedFiles[key].fileName);
        }
      });
    return fileNames;
  },
  rootFolderNames(state) {
    const folderNames = [];
    Object.keys(state.fetchedFiles)
      .forEach((key) => {
        if (state.fetchedFiles[key].type === 'folder') {
          folderNames.push(state.fetchedFiles[key].folderName);
        }
      });
    return folderNames;
  },
  pathFileNames(state) {
    const fileNames = [];
    Object.keys(state.pathFiles)
      .forEach((key) => {
        if (state.pathFiles[key].type === 'file') {
          fileNames.push(state.pathFiles[key].fileName);
        }
      });
    return fileNames;
  },
  pathFolderNames(state) {
    const folderNames = [];
    Object.keys(state.pathFiles)
      .forEach((key) => {
        if (state.pathFiles[key].type === 'folder') {
          folderNames.push(state.pathFiles[key].folderName);
        }
      });
    return folderNames;
  },
  currentPath(state) {
    return state.currentPath;
  },
};

export default {
  state,
  actions,
  mutations,
  getters,
};
