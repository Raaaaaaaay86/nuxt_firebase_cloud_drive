/* eslint-disable no-shadow */
/* eslint-disable no-param-reassign */
import { storage, database } from '@/plugins/firebase';
import Vue from 'vue';

const state = () => ({
  // eslint-disable-next-line no-new-object
  fetchedFiles: {},
});

const actions = {
  nuxtServerInit(vueContext) {
    return database.ref('files').once('value', (snap) => {
      vueContext.commit('SET_FILES_DATA', snap.val());
    });
  },
  uploadFile(context, e) {
    if (e.target.files.length === 0) {
      return;
    }
    const file = e.target.files[0];
    const { size } = e.target.files[0];
    const storageRef = storage.ref(`files/${file.name}`);

    storageRef.put(file)
      .then(() => {
        storageRef.getDownloadURL()
          .then((snap) => {
            const pushRef = database.ref('/files').push();
            const data = {
              downloadURL: snap,
              fileName: file.name,
              storagePath: `files/${file.name}`,
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
  deleteFile(context, key) {
    const storageRef = storage.ref();
    database.ref(`files/${key}`).once('value', (snap) => snap)
      .then((snap) => {
        const { storagePath, key } = snap.val();
        storageRef.child(storagePath)
          .delete()
          .then(() => {
            database.ref(`files/${key}`).remove();
          });
      })
      .then(() => {
        context.commit('REMOVE_FILES_DATA', key);
      });
  },
  toggleArchive(context, { key, archive }) {
    database.ref(`files/${key}/archive`)
      .set(!archive)
      .then(() => {
        context.commit('SET_FILES_ARCHIVE', { key, archive });
      });
  },
};

const mutations = {
  SET_FILES_DATA(state, data) {
    state.fetchedFiles = data;
  },
  ADD_FILES_DATA(state, data) {
    if (!state.fetchedFiles) {
      this.dispatch('nuxtServerInit');
    } else {
      Vue.set(state.fetchedFiles, data.key, data);
    }
  },
  REMOVE_FILES_DATA(state, key) {
    Vue.delete(state.fetchedFiles, key);
  },
  SET_FILES_ARCHIVE(state, { key, archive }) {
    state.fetchedFiles[key].archive = !archive;
  },
};

const getters = {
  fetchedFiles(state) {
    return state.fetchedFiles;
  },
  archivedFiles(state) {
    const data = {};
    Object.keys(state.fetchedFiles).forEach((key) => {
      if (state.fetchedFiles[key].archive) {
        data[key] = state.fetchedFiles[key];
      }
    });
    return data;
  },
};

export default {
  state,
  actions,
  mutations,
  getters,
};
