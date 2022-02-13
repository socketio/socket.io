/* abstract */ class ProfileStore {
  saveProfile(profile) {}
  findProfile(id) {}
  findAllProfiles() {}
}

class InMemoryProfileStore extends ProfileStore {
  constructor() {
    super();
    this.profiles = {};
  }

  saveProfile(id, profile) {
    this.profiles[id] = {...profile, id};
  }

  findProfile(id) {
    return this.profiles[id];
  }

  findAllProfiles() {
    return this.profiles;
  }
}

const PROFILE_TTL = 24 * 60 * 60;

const mapProfile = ([id, lastSeen]) => id ? { id, lastSeen } : undefined ;

class RedisProfileStore extends ProfileStore {
  constructor(redisClient) {
    super();
    this.redisClient = redisClient;
  }

  saveProfile(id, { lastSeen }) {

      this.redisClient
        .multi()
        .hset(
          `profile:${id}`,
          "id",
          id,
          "lastSeen",
          lastSeen
        )
        .expire(`profile:${id}`, PROFILE_TTL)
        .exec();
    }

    findProfile(id) {
      return this.redisClient
        .hmget(`profile:${id}`, "id", "lastSeen")
        .then(mapProfile);
    }

    async findAllProfiles() {
      const keys = new Set();
      let nextIndex = 0;
      do {
        const [nextIndexAsStr, results] = await this.redisClient.scan(
          nextIndex,
          "MATCH",
          "profile:*",
          "COUNT",
          "100"
        );
        nextIndex = parseInt(nextIndexAsStr, 10);
        results.forEach((s) => keys.add(s));
      } while (nextIndex !== 0);
      const commands = [];
      keys.forEach((key) => {
        commands.push(["hmget", key, "id", "lastSeen"]);
      });
      return this.redisClient
        .multi(commands)
        .exec()
        .then((results) => {
          return results
            .map(([err, profile]) => (err ? undefined : mapProfile(profile)))
            .filter((v) => !!v);
        });
    }
}

module.exports = {
  InMemoryProfileStore,
  RedisProfileStore,
};
