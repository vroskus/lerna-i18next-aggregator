#! /usr/bin/env node

/* eslint-disable no-console */

const fs = require('fs');
const scanner = require('i18next-scanner');
const vfs = require('vinyl-fs');

const languagesArg = process.argv[2]; // languages
const resourcesDirPath = process.argv[3]; // resource files dir path
const packagesDirPath = process.argv[4]; // lerna packages dir path

const defaultTranslationValue = '__TRANSLATION__';
const tmpDir = './tmp';
const fileExtensions = [
  'js',
  'jsx',
  'ts',
  'tsx',
  'pug',
];

/* eslint-disable-next-line complexity */
const checkArgs = () => {
  try {
    if (!languagesArg) {
      throw new Error('Arg [0]: Languages list is not defined!');
    }

    if (!resourcesDirPath) {
      throw new Error('Arg [1]: Resource files directory path is not defined!');
    }

    if (!packagesDirPath) {
      throw new Error('Arg [2]: Lerna packages directory path is not defined!');
    }
  } catch (error) {
    console.error(error.message);

    process.exit();
  }
};

function customTransform(file, enc, done) {
  const {
    parser,
  } = this;

  const content = fs.readFileSync(
    file.path,
    enc,
  );

  parser.parseFuncFromString(
    content,
    {
      list: ['t'],
    },
    (key) => {
      parser.set(
        key,
        defaultTranslationValue,
      );
    },
  );

  done();
}

const sort = (input) => Object.keys(input).sort().reduce(
  (obj, key) => {
    const uObj = obj;

    uObj[key] = input[key];

    return uObj;
  },
  {
  },
);

const getPackageNames = (dirPath) => fs.readdirSync(dirPath)
  .filter((file) => file !== 'common.json')
  .map((file) => file.replace(
    '.json',
    '',
  ));

const extractKeys = (packageName) => {
  const options = {
    keySeparator: false,
    resource: {
      savePath: `${packageName}.json`,
    },
  };

  const filePaths = fileExtensions.map((
    fileExtension,
  ) => `${packagesDirPath}/${packageName}/src/**/*.${fileExtension}`);

  return new Promise((resolve) => {
    vfs
      .src(filePaths)
      .pipe(scanner(
        options,
        customTransform,
      ))
      .pipe(vfs.dest(tmpDir))
      .on(
        'end',
        () => resolve(),
      );
  });
};

const extract = async (packageNames) => {
  for (let index = 0; index < packageNames.length; index += 1) {
    const packageName = packageNames[index];

    await extractKeys(packageName);
  }
};

const getTranslationKeys = async (packageNames) => {
  const translationKeys = {
  };

  for (let index = 0; index < packageNames.length; index += 1) {
    const packageName = packageNames[index];

    const dataFilePath = `${tmpDir}/${packageName}.json`;
    const dataString = fs.readFileSync(dataFilePath);
    const data = JSON.parse(dataString);

    translationKeys[packageName] = data;
  }

  return translationKeys;
};

/* eslint-disable-next-line complexity */
const getCommonTranslationKeys = async (packageNames, rawTranslationKeys) => {
  const translationKeys = rawTranslationKeys;
  const rawCommon = {
  };
  const common = {
  };

  for (let index = 0; index < packageNames.length; index += 1) {
    const packageName = packageNames[index];

    for (const [key] of Object.entries(translationKeys[packageName])) {
      if (rawCommon[key]) {
        rawCommon[key] += 1;
      } else {
        rawCommon[key] = 1;
      }
    }
  }

  for (const [key] of Object.entries(rawCommon)) {
    if (rawCommon[key] > 1) {
      common[key] = defaultTranslationValue;
    }
  }

  for (let index = 0; index < packageNames.length; index += 1) {
    const packageName = packageNames[index];

    for (const [key] of Object.entries(common)) {
      if (translationKeys[packageName][key]) {
        delete translationKeys[packageName][key];
      }
    }
  }

  translationKeys.common = common;

  return translationKeys;
};

const getTrash = () => {
  const trashPath = `${resourcesDirPath}/trash.json`;
  let trash = {
  };

  if (fs.existsSync(trashPath)) {
    const trashDataString = fs.readFileSync(trashPath);

    const foundTrash = JSON.parse(trashDataString);

    if (foundTrash) {
      trash = foundTrash;
    }
  } else {
    const trashDataString = JSON.stringify(trash);

    fs.writeFileSync(
      trashPath,
      trashDataString,
      'utf8',
    );
  }

  return trash;
};

/* eslint-disable-next-line complexity */
const getTranslations = async (languages, translationKeys) => {
  const translations = {
  };
  const trash = getTrash();

  for (const [packageName] of Object.entries(translationKeys)) {
    const packageTranslationKeys = translationKeys[packageName];
    const packageFilePath = `${resourcesDirPath}/${packageName}.json`;
    const packageDataString = fs.readFileSync(packageFilePath);
    const prevTranslations = JSON.parse(packageDataString) || {
    };

    translations[packageName] = {
    };

    for (let index = 0; index < languages.length; index += 1) {
      const language = languages[index];
      const translation = {
      };

      if (!prevTranslations[language]) {
        prevTranslations[language] = {
          translation: {
          },
        };
      }

      if (!trash[language]) {
        trash[language] = {
        };
      }

      for (const [key] of Object.entries(packageTranslationKeys)) {
        if (prevTranslations[language].translation[key]) {
          translation[key] = prevTranslations[language].translation[key];

          delete prevTranslations[language].translation[key];
        } else {
          translation[key] = defaultTranslationValue;
        }
      }

      translations[packageName][language] = {
        translation: sort(translation),
      };

      trash[language] = {
        ...trash[language],
        ...prevTranslations[language].translation,
      };
    }
  }

  translations.trash = trash;

  return translations;
};

const saveTranslations = async (translations) => {
  for (const [packageName, data] of Object.entries(translations)) {
    const dataString = JSON.stringify(
      data,
      undefined,
      2,
    );

    fs.writeFileSync(
      `${resourcesDirPath}/${packageName}.json`,
      dataString,
      'utf8',
    );
  }
};

const main = async () => {
  checkArgs();

  const languages = languagesArg.split(',');

  console.info(
    'Languages:',
    languages,
  );

  const packageNames = getPackageNames(resourcesDirPath);

  console.info(
    'Packages:',
    packageNames,
  );

  await extract(packageNames);

  const rawTranslationKeys = await getTranslationKeys(packageNames);

  const translationKeysWithCommon = await getCommonTranslationKeys(
    packageNames,
    rawTranslationKeys,
  );

  const translations = await getTranslations(
    languages,
    translationKeysWithCommon,
  );

  await saveTranslations(translations);

  fs.rmSync(
    tmpDir,
    {
      force: true,
      recursive: true,
    },
  );
};

main();
